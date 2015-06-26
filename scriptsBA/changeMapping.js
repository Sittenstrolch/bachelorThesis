var q       = require('q')
var config  = require('../config.js')
var esearch = require('elasticsearch')
var request       = require('request')

var company = config.company,
    crawlerIndex = config.crawlerIndex,
    metaIndex      = config.metaIndex,
    allPostsIndex = '_post_*',
    version = config.postIndexVersionNumber

var index = "sap_post_*",
    newMapping = {
                "company": {
                    "properties":{
                        "id": {
                            "type": "string",
                            "index": "not_analyzed"
                        },
                        "permalink": {
                            "type": "string"
                        },
                        "source": {
                            "type": "string",
                            "index": "not_analyzed"
                        },
                        "name": {
                            "type": "string"
                        },
                        "founded": {
                            "type": "long"
                        },
                        "employeeCount": {
                            "type": "string",
                            "index": "not_analyzed"
                        },
                        "industries": {
                            "properties": {
                                "name": {
                                    "type": "string",
                                    "index": "not_analyzed"
                                }
                            }
                        },
                        "role": {
                            "type": "string",
                            "index": "not_analyzed"
                        },
                        "logo": {
                            "type": "string",
                            "index": "no"
                        },

                        "locations": {
                            "properties": {
                                "city": {
                                    "type": "string",
                                    "index": "not_analyzed"
                                },
                                "countryCode": {
                                    "type": "string",
                                    "index": "not_analyzed"
                                },
                                "postalCode": {
                                    "type": "string",
                                    "index": "not_analyzed"
                                },
                                "street": {
                                    "type": "string"
                                },
                                "region": {
                                    "type": "string",
                                    "index": "not_analyzed"
                                },
                                "geo": {
                                    "type": "geo_point",
                                    "lat_lon": true
                                }

                            }
                        }
                    }



                }
    },
    indexType = "company"


var elasticClient = new esearch.Client({
    host: config.database.dev_host + ':' + config.database.port
})


elasticClient.ping({
    requestTimeout: 1000,
    hello: "elasticsearch!"
}, function (error) {
    if (error) {
        console.log('elasticsearch cluster is down!');
    } else {
        console.log('ElasticSearch is now connected!');
        //startReMapping()
        createMapping("ba_companies_merged")
            .then(function(name){
                console.log("finished creating Mapping for " + name)
                process.exit(1)
            })
    }
})

function startReMapping(){
    var matchingRegex = new RegExp("_v"+version, "g")
    var countInWork = 0

    elasticClient.indices.getMapping()
        .then(function(data){
            for(var key in data){
                if(key.match(matchingRegex)) {
                    var newIndexName = key.replace("_v"+version, "_v"+(version+1))
                    countInWork++
                    createNewIndex(newIndexName, config.numberOfShards)
                        .then(createMapping)
                        .then(reIndex)
                        .then(checkSuccess)
                        //.then(deleteOldIndex)
                        .then(function(index){
                            console.log("Mapping change for index " + index.newIndex + " was successfull")
                            countInWork = countInWork - 1
                            if(countInWork == 0){
                                console.log("\n************************************************************************************************************************************")
                                console.log(" \t \t Remapping finished! Dont forget to increment the current postIndexVersionNumber in the config")
                                console.log("************************************************************************************************************************************")
                                process.exit(1)
                            }
                        })
                        .catch(function(err){
                            console.log("somme error occured: " + err)
                        })
                }
            }
        })
}

function createNewIndex(indexName, numberOfShards) {
    var deferred = q.defer()

    console.log("createIndex " + indexName)

    elasticClient.indices.create({
        index: indexName,
        ignore_conflicts: true
    }).then(function (r) {
        deferred.resolve(indexName)
    }).catch(deferred.reject)

    return deferred.promise
}

function createMapping(indexName){
    var deferred = q.defer()

    console.log("createMapping " + indexName)

    elasticClient.indices.putMapping({
        index: indexName,
        type: "company",
        body: newMapping
    }).then(function() {
        deferred.resolve(indexName)
    }).catch(function(err){
        console.log(err)
        deferred.reject(err)
    })

    return deferred.promise
}

function reIndex(indexName){
    var deferred = q.defer(),
        from = indexName.replace("_v"+(version+1), "_v"+version),
        to = indexName

    console.log("Reindex from " + from + " to " + to)
    deferred.resolve({
        oldIndex: from,
        newIndex: to
    })

    //var bulk = {
    //    body: []
    //}
    //
    //elasticClient.search({
    //    index: from,
    //    type: "post",
    //    size: 100000
    //
    //}).then(function (result) {
    //    console.log("results: " + result.hits.hits.length)
    //    for (var i = 0; i < result.hits.hits.length; i++) {
    //        bulk.body.push({
    //            create: {
    //                _index: endIndex,
    //                _type: 'post',
    //                _id: result.hits.hits[i]._id
    //            }
    //        })
    //        bulk.body.push(convertOldMappingToNewMapping(result.hits.hits[i]._source))
    //    }
    //
    //    elasticClient.bulk(bulk, function(err, resp){
    //        if(err)
    //            console.log("Bulk : " + err)
    //        deferred.resolve({
    //            oldIndex: from,
    //                newIndex: to
    //        })
    //    })
    //
    //}).catch(function(err){
    //    console.log(err)
    //    deferred.reject(err)
    //})

    return deferred.promise
}

function checkSuccess(indices){
    var deferred = q.defer()

    console.log("Check whether data copy was successful from " + indices.oldIndex + " to "+ indices.newIndex)
    deferred.resolve(indices)

    return deferred.promise
}

function deleteOldIndex(indices){
    var deferred = q.defer()

    console.log("Deleted " + indices.oldIndex)

    deferred.resolve(indices)

    return deferred.promise
}

function convertOldMappingToNewMapping(oldSource){
    var newSource = oldSource

    return newSource
}