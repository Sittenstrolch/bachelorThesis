var q       = require('q')
var config  = require('../config.js')
var esearch = require('elasticsearch')
var request       = require('request')

var fs = require('fs')

var company = config.company,
    crawlerIndex = config.crawlerIndex,
    metaIndex      = config.metaIndex,
    allPostsIndex = '_post_*',
    host = '141.89.225.46',
    port = 9200

var elasticClient = new esearch.Client({
    host: host + ":" + port //config.database.dev_host + ':' + config.database.port
})

var token = "def1fecedee41e6d3d6650a4f6d6de5e"

elasticClient.ping({
    requestTimeout: 2000,
    hello: "elasticsearch!"
}, function (error) {
    if (error) {
        console.log('elasticsearch cluster is down!');
    } else {
        console.log('ElasticSearch is now connected!');
        //Adding Permalinks to current dataset
        function populate() {
            getCompaniesFromDB()
                .then(iterateResult)
                .then(function(finished){
                    //console.log(JSON.stringify(data, null, 4).substring(0,2000))
                    if(finished){
                        console.log("finished")
                        process.exit(1)
                    }else
                        populate()
                })
        }

        populate()

    }
})

function getCompaniesFromDB(){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_cb",
        type: "company",
        size: 1000,
        body: {
            filter: {
                and: [
                    {
                        exists: {
                            field: "crawled"
                        }
                    },
                    {
                        not: {
                            exists: {
                                field: "merged"
                            }
                        }
                    }
                ]
            }
        }
    }).then(function(data){
        deferred.resolve(data.hits)
    })

    return deferred.promise
}

function iterateResult(data){
    var deferred = q.defer(),
        index = 0

    function processCompany(){
        getCompany(data.hits[index]._id)
            .then(processData)
            .then(updateCompany)
            .then(function(company){
                index += 1
                console.log("updated company " + company + " at index " + index + "/" + data.hits.length)

                if(index == data.hits.length) {
                    console.log("Part finished getting next one")
                    deferred.resolve(false)
                }else {
                    processCompany()
                }
            })
            .catch(function(err){
                console.log("Some error in process Company " + err)
                updateCompany({id: data.hits[index]._id, data: {}}, true)
                index += 1
                processCompany()
            })
    }

    if(data.hits.length == 0)
        deferred.resolve(true)

    processCompany()

    return deferred.promise
}

function getCompany(id){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_cb_ext",
        body: {
            query: {
                ids:{
                    type: "company",
                    values: [id]
                }
            }
        }
    }).then(function(data){
        //console.log(JSON.stringify(data.hits.hits, null, 4))
        if(data.hits.total > 0 && Object.keys(data.hits.hits[0]._source).indexOf("error") == -1){
            if(data.hits.total == 1)
                deferred.resolve(data.hits.hits[0]._source)
            else
                deferred.reject("Id matches more companies")
        }else{
            deferred.reject("error for id " + id)
            //deferred.reject(data.hits.hits[0]._source.error.message)
        }
    })


    return deferred.promise
}

function processData(data){
    var deferred = q.defer(),
        newData = {},
        offices = [],
        hq = [],
        industries = []

    if(data.relationships.offices)
        offices = data.relationships.offices.items

    if(data.relationships.headquarters)
        hq = data.relationships.headquarters.items

    if(data.relationships.categories)
        industries = data.relationships.categories.items

    try {
        if (data.properties.founded_on_year)
            newData.foundingYear = data.properties.founded_on_year
        if (data.properties.num_employees_min)
            newData.employeesMin = data.properties.num_employees_min
        if (data.properties.num_employees_max)
            newData.employeesMax = data.properties.num_employees_max


        newData.offices = []

        for (var i = 0; i < offices.length; i++) {
            newData.offices.push({
                country: offices[i].country,
                region: offices[i].region,
                city: offices[i].city,
                street: offices[i].street_1
            })
        }

        function officeExists(office) {
            for (var j = 0; j < newData.offices.length; j++) {
                if (newData.offices[j].country == office.country &&
                    newData.offices[j].region == office.region &&
                    newData.offices[j].city == office.city)
                    return true
            }
            return false
        }

        for (var i = 0; i < hq.length; i++) {
            if (!officeExists(hq[i])) {
                newData.offices.push({
                    country: hq[i].country,
                    region: hq[i].region,
                    city: hq[i].city,
                    street: hq[i].street_1
                })
            }
        }

        if(industries){
            newData.industries = []
            for(var i=0; i<industries.length; i++){
                newData.industries.push(industries[i].name)
            }
        }

        deferred.resolve({
            data: newData,
            id: data.uuid
        })
    }catch(err){
        console.log(err)
        deferred.reject(err)
    }


    return deferred.promise
}

function updateCompany(company, fail){
    var deferred = q.defer()
    if(!fail)
        company.data.merged = true
    else
        company.data.merged = false

    elasticClient.update({
        index: 'ba_companies_cb',
        id: company.id,
        type: "company",
        ignoreUnavailable: true,
        allowNoIndices: true,
        body: {
            doc: company.data
        }
    }, function(err) {
        if(err) {
            //console.log(err)
            deferred.reject(err)
        }else {
            //console.log("updated company with id: " + company.uuid + " and link " + company.properties.permalink + " with index " + company.index)
            deferred.resolve(company.id)
        }
    })

    return deferred.promise
}
