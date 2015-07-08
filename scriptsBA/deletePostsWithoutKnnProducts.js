var q               = require('q'),
    config          = require(__dirname + '/../config.js'),
    esearch         = require('elasticsearch'),
    fs              = require('fs'),
    clusterfck      = require('clusterfck'),
    companyCluster  = require(__dirname + '/../companyCluster.js')

var elasticClient = new esearch.Client({
    host: config.database.dev_host + ':' + config.database.port
})

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
        getPosts()
            .then(correctCompanies)
            .then(function(){
                console.log("\nFinished! ")

                var timePassed = ( Date.now() - startDate ) / 1000 / 60
                console.log("Time passed " + timePassed + " min")
                process.exit(1)
            })
            .catch(function(err){
                console.log(err)
            })
    }
})

function getPosts(){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_post_companies",
        type: "post",
        size: 5000,
        body: {
            filter: {
                and:[
                    {
                            missing:{
                                field: "knnProducts"
                            }
                    }
                ]

            }
        }
    }).then(function(result){
        var companies = []
        for(var i=0; i<result.hits.hits.length; i++){
            companies.push(result.hits.hits[i]._source.company.id)
        }
        deferred.resolve(companies)
    })
        .catch(deferred.reject)

    return deferred.promise
}

function correctCompanies(companies){
    var deferred = q.defer(),
        bulk = []

    for(var i=0; i<companies.length;i++){
        bulk.push({
            update: {
                _index: 'ba_companies_merged',
                _type: "company",
                _id: companies[i]
            }
        })
        bulk.push({
            doc:{
                hasPost: false
            }
        })
    }

    saveBulk(bulk)
        .then(function(){
            deferred.resolve()
        })

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