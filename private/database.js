var q       = require('q')
var config  = require('../config.js')
var esearch = require('elasticsearch')

var elasticClient = new esearch.Client({
    host: config.database.dev_host + ':' + config.database.port
})

elasticClient.ping({
    requestTimeout: 1000,
    hello: "elasticsearch!"
}, function (error) {
    if (error) {
        console.log('elasticsearch cluster Dev is down!');
    } else {
        console.log('ElasticSearch Dev is now connected!');
    }
})

exports.getAllLinks = function(){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_links",
        type: "link",
        size: 500000,
        body: {
        }
    }).then(function(result){
            var links = []
            for(var i=0; i<result.hits.hits.length; i++){
                result.hits.hits[i]._source.value = result.hits.hits[i]._source.distance
                delete result.hits.hits[i]._source.distance
                links.push(result.hits.hits[i]._source)
            }

            deferred.resolve(links)
        })
        .catch(deferred.reject)


    return deferred.promise
}

exports.getLinksForCompany = function(companyId, index){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_links",
        type: "link",
        size: 20,
        body: {
            query: {
                multi_match: {
                    query: companyId,
                    fields: ["source", "target"]
                }
            },
            sort: [
                {"distance": {order: "asc"}}
            ]
        }
    }).then(function(result){
        var links = []
        for(var i=0; i<result.hits.hits.length; i++){
            if(result.hits.hits[i]._source.source == companyId)
                result.hits.hits[i]._source.source = index
            else
                result.hits.hits[i]._source.target = index

            result.hits.hits[i]._source.value = result.hits.hits[i]._source.distance
            delete result.hits.hits[i]._source.distance
            links.push(result.hits.hits[i]._source)
        }

        deferred.resolve(links)
    })
        .catch(deferred.reject)

    return deferred.promise
}

exports.getAllCompanies = function(){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_merged",
        type: "company",
        size: 10000,
        body: {
            filter: {
                and: [
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
                    {
                        exists: {
                            field: "hasPost"
                        }
                    }
                ]
            }
        }
    }).then(function(result){
        var companies = result.hits.hits,
            comp = []

        for(var i=0; i<companies.length; i++){
            var company = {}
            company.name = companies[i]._id
            company.group = companies[i]._source.industries[0]
            comp.push(company)
        }

        deferred.resolve(comp)

    })
        .catch(deferred.reject)

    return deferred.promise
}

exports.clusters = function(){

}