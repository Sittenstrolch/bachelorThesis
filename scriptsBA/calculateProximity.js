var q               = require('q'),
    config          = require(__dirname + '/../config.js'),
    industryMapping = require(__dirname + '/../industries.js'),
    esearch         = require('elasticsearch'),
    fs              = require('fs'),
    companyCluster  = require(__dirname + '/../companyCluster.js')

var elasticClient = new esearch.Client({
    host: config.database.dev_host + ':' + config.database.port
})

var storedCompanies = 0,
    distribution = {}

elasticClient.ping({
    requestTimeout: 2000,
    hello: "elasticsearch!"
}, function (error) {
    if (error) {
        console.log('elasticsearch cluster is down!');
    } else {
        console.log('ElasticSearch is now connected!');
        var startDate = Date.now()

        console.log("Started on " + new Date(startDate))
        requestAllCompanies()
            .then(compareCompanies)
            .then(function(){
                console.log("\nFinished! ")
                console.log(distribution)

                var timePassed = ( Date.now() - startDate ) / 1000 / 60
                console.log("Time passed " + timePassed + " min")
                process.exit(1)
            })
    }
})

function requestAllCompanies(){
    var deferred = q.defer(),
        offset = 0,
        size = 10000,
        companies = [],
        max = 0

    function makeRequest(){
        getCompanies(offset, size)
            .then(function(result){
                max = result.total
                result = result.hits


                if(result.length > 0) {
                    companies = companies.concat(result)
                    offset += result.length
                    updateProgress(offset, max)
                    //fs.writeFile(__dirname + "/companies.json", JSON.stringify(companies, null, 4), function(err){if(err){process.stderr.write(err)}})
                    makeRequest()
                }else{
                    //console.log("\n Got all companies " + companies.length)
                    deferred.resolve(companies)
                }
            })
    }

    makeRequest()
    updateProgress(offset, 100)

    return deferred.promise
}

function updateProgress(current, max, text){
    process.stdout.clearLine()
    process.stdout.cursorTo(0)

    var percent = Math.round(current / max * 100),
        progress = "",
        message = "Loading... "

    if(text)
        message = text

    for(var i=0; i<100;i+=5){
        if(percent > i){
            progress += "#"
        }else{
            progress += " "
        }
    }

    process.stdout.write(message + percent + "% " + "["+progress+"] \t " + current + " / " + max)
}

function getCompanies(from, size){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_merged",
        type: "company",
        size: size,
        from: from,
        body:{
            filter: {
                and: [
                    //{
                    //    exists: {
                    //        field: "expertise"
                    //    }
                    //},
                    {
                        exists: {
                            field: "locations"
                        }
                    },
                    {
                        exists: {
                            field: "industries"
                        }
                    },
                    //{
                    //    exists: {
                    //        field: "founded"
                    //    }
                    //},
                    {
                        exists: {
                            field: "employeesMin"
                        }
                    },
                    {
                        exists: {
                            field: "employeesMax"
                        }
                    },
                    //{
                    //    exists: {
                    //        field: "linkedin_id"
                    //    }
                    //},
                    //{
                    //    exists: {
                    //        field: "crunchbase_uuid"
                    //    }
                    //},
                    {
                        exists: {
                            field: "hasPost"
                        }
                    }
                ]
            }
        }
    }).then(function(result){
        deferred.resolve(result.hits)
    }).catch(function(error){
        console.log(error)
    })

    return deferred.promise
}

function compareCompanies(companies){
    var companyCount = companies.length,
        deferred = q.defer()

    //updateProgress(storedCompanies,companyCount, "Processing companies... ")

    function processCompany(){
        var company = companies.pop(),
            distances = {}

        //console.log("Processing company " + company._id + " with " + companies.length + " left")
        for(var j=0; j<companies.length; j++){
            //13 is the max Value of closeness
            var dist = 13 - calcDistance(company._source, companies[j]._source)

            if(distribution[dist])
                distribution[dist] = distribution[dist] + 1
            else
                distribution[dist] = 1

            if(dist != 13){
                distances[companies[j]._id] = dist
                //savePromises.push(saveDistance(company._id,companies[j]._id, dist))
            }
        }
        //console.log(storedCompanies + "\t Finished company " + company._id + " found distances " + Object.keys(distances).length)
        //distances = {}
        //storedCompanies++

        //if(storedCompanies%500 == 0){
            //updateProgress(storedCompanies,companyCount, "Processing companies... ")
        ////}
        //if(companies.length == 0){
        //    deferred.resolve()
        //}else{
        //    processCompany()
        //}

        saveDistances(company._id, distances, storedCompanies)
            .then(function(){
                storedCompanies++
                //if(storedCompanies % 300 == 0){
                    updateProgress(storedCompanies,companyCount, "Processing companies... ")
                //}

                if(companies.length == 0){
                    deferred.resolve()
                }else{
                    processCompany()
                }
            })
            .catch(function(err){
                console.log(err)
            })
    }

    processCompany()

    return deferred.promise
}

function saveDistances(id, distances){
    var deferred = q.defer(),
        keys = Object.keys(distances),
        index = 0,
        bulkSize = 20000

    function save(){
        var bulk = []

        if(bulkSize > keys.length-index)
            bulkSize = keys.length

        for(var i=0; i<bulkSize; i++){
            bulk.push({
                index: {
                    _index: 'ba_companies_links',
                    _type: "link",
                    _id: id + "_" + keys[index]
                }
            })
            bulk.push({
                source: id,
                target: keys[index],
                distance: distances[keys[index]]
            })
            index++
        }

        saveBulk(bulk)
            .then(function(){
                //updateProgress(index,keys.length, storedCompanies +  "\t stored current company: " + id + " \t Saving Links... ")

                if(index >= keys.length)
                    deferred.resolve()
                else
                    save()
            })
            .catch(function(err){
                deferred.reject(err)
            })

        //saveDistance(id, keys[index], distances[keys[index]])
        //    .then(function(){
        //        updateProgress(index,keys.length, "Saving Links... ")
        //        index++
        //
        //        if(index == keys.length)
        //            deferred.resolve()
        //        else
        //            save()
        //    })
        //    .catch(function(){
        //        deferred.reject()
        //    })
    }
    save()

    return deferred.promise
}

function saveBulk(bulk){
    var deferred = q.defer()

    elasticClient.bulk({
        body: bulk
    }, function(err, resp){
        if(err){
            deferred.reject(err)
        }else{
            deferred.resolve()
        }
    })

    return deferred.promise
}

function saveDistance(id, otherId, distance){
    var deferred = q.defer(),
        link = {
            source: id,
            target: otherId,
            distance: distance
        }

    elasticClient.update({
        index: "ba_companies_links",
        type: "company",
        id: id + "_" + otherId,
        ignoreUnavailable: true,
        allowNoIndices: true,
        body: link
    }, function(err) {
        if(err && err.message == 'ActionRequestValidationException[Validation Failed: 1: script or doc is missing;]') {
            elasticClient.index({
                index: "ba_companies_links",
                type: 'company',
                id: id + "_" + otherId,
                ignoreUnavailable: true,
                allowNoIndices: true,
                body: link
            }, function(err) {
                if(err) {
                    deferred.reject(err)
                }else
                    deferred.resolve()
            })

        }else if(err) {
            deferred.reject(err)
        }else{
            deferred.resolve()
        }
    })

    return deferred.promise
}
/***
 *
 * Features:
 * location     -   has at least one same location sameCity(+5) sameCountry (+2)
 * industry     -   has one common industry (+5) / has more than 4 common industries (+1)
 * size         -   has the same size (+2)
 *
 * possible Maximum value 13
 */
function calcDistance(company1, company2){
    return companyCluster.compare(company1, company2)
}