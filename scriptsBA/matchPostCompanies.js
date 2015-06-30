var q       = require('q')
var config  = require('../config.js')
var esearch = require('elasticsearch')
var request       = require('request')

var fs = require('fs')

var company = config.company,
    crawlerIndex = config.crawlerIndex,
    metaIndex      = config.metaIndex,
    allPostsIndex = '_post_*'

var elasticClientDep = new esearch.Client({
    host: config.database.dep_host + ':' + config.database.port
})

var elasticClientDev = new esearch.Client({
    host: config.database.dev_host + ':' + config.database.port
})

var matches = 0,
    bulk = []

elasticClientDep.ping({
    requestTimeout: 1000,
    hello: "elasticsearch!"
}, function (error) {
    if (error) {
        console.log('elasticsearch cluster Dep is down!');
    } else {
        console.log('ElasticSearch Dep is now connected!');

        elasticClientDev.ping({
            requestTimeout: 1000,
            hello: "elasticsearch!"
        }, function (error) {
            if (error) {
                console.log('elasticsearch cluster Dev is down!');
            } else {
                console.log('ElasticSearch Dev is now connected!');
                var offset = 0

                function start(){
                    getPosts(offset)
                        .then(processCompanies)
                        .then(function(companies){
                            offset += companies.length
                            updateProgress(offset, 32728, "Processing companies...")

                            saveBulk(bulk)
                                .then(function(){
                                    bulk = []
                                    start()
                                })
                        })
                        .catch(function(action){
                            if(action == "no more companies"){
                                console.log("Finished with " + matches + " matches")
                                process.exit(1)
                            }
                            else
                                console.log(action)
                        })
                }

                start()

                updateProgress(0,100,"Processing companies")
            }
        })
    }
})

function getPosts(offset){
    var deferred = q.defer(),
        size = 5000

    elasticClientDep.search({
        index: "sap" + allPostsIndex,
        type: "post",
        size: size,
        from: offset,
        body:{
            filter:{
                and:[
                    {
                            exists: {
                                field: "company.name"
                            }

                    },
                    {
                        exists: {
                            field: "company"
                        }
                    }
                ]
            }
        }
    }).then(function(result){
        deferred.resolve(result.hits.hits)
    }).catch(deferred.reject)

    return deferred.promise
}

function processCompanies(posts){
    var promises = [],
        deferred = q.defer()

    if(posts.length == 0) {
        deferred.reject("no more companies")
    }

    for(var i=0; i<posts.length; i++){
        promises.push(matchCompany(posts[i]._source.company))
    }

    q.all(promises)
        .then(function(ids){
            for(var j=0; j < ids.length; j++){
                if(ids[j] != -1){
                    posts[j]._source.company.id = ids[j]
                    bulk.push({
                        index: {
                            _index: 'ba_post_companies',
                            _type: "post",
                            _id: posts[j]._id
                        }
                    })
                    bulk.push(posts[j]._source)
                }
            }

            deferred.resolve(posts)
        })
        .catch(deferred.reject)

    return deferred.promise
}

function matchCompany(company){
    var deferred = q.defer()

    elasticClientDev.search({
        index: "ba_companies_merged",
        type: "company",
        body: {
            query: {
                match_phrase: {
                    "company.name": company.name
                }
            }
        }
    }).then(function(result){
        var id = -1
        if(result.hits.hits.length > 5)
            id = equalCompany(company, result.hits.hits)
        else if(result.hits.hits.length > 0)
           id = equalCompany(company, result.hits.hits.slice(0,6))

        deferred.resolve(id)
    })
    .catch(deferred.reject)

    return deferred.promise
}

function equalCompany(postCompany, companies){
    for(var i=0; i<companies.length; i++){
        if(postCompany.name.toLowerCase() == companies[i]._source.name.toLowerCase()){
            //console.log("Match for " + postCompany.name)
            bulk.push({
                update: {
                    _index: 'ba_companies_merged',
                    _type: "company",
                    _id: companies[i]._id
                }
            })
            bulk.push({
                doc: {
                    hasPost: true
                }
            })

            matches++
            return companies[i]._id
        }
    }
    return -1
}

function saveBulk(bulk){
    var deferred = q.defer()

    elasticClientDev.bulk({
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