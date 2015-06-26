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
        size: 2000,
        body: {
            filter: {
                and: [
                    {
                        not: {
                            exists: {
                                field: "crawled"
                            }
                        }
                    },
                    {
                        exists: {
                            field: "permalink"
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
        getCompany(data.hits[index]._source.permalink, data.hits[index]._id)
            .then(saveToDb)
            //.then(processData)
            //.then(updateCompany)
            .then(function(company){
                index += 1
                console.log("saved company " + company + " at index " + index + "/" + data.hits.length)

                if(index == data.hits.length) {
                    console.log("Part finished getting next one")
                    updateCompany(company, true)
                        .then(function(){
                            deferred.resolve(false)
                        })
                }else {
                    processCompany()
                    updateCompany(company, true)
                }
            })
            .catch(function(){

                wait(30000).then(processCompany)
                updateCompany(data.hits[index]._id, false)
                index += 1
            })
    }

    if(data.hits.length == 0)
        deferred.resolve(true)

    processCompany()

    return deferred.promise
}

function getCompany(permalink, id){
    var deferred = q.defer(),
        endpoint = "/organization/" + permalink + "?user_key=" + token,
        parameters = {
            url: 'https://api.crunchbase.com/v/2' + endpoint,
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36"
            }
        }

    request(parameters, function (error, response, body) {
        if(!error) {
            try {
                var data = JSON.parse(body)
                if (data.data)
                    deferred.resolve({data: data.data, id: id})
                else {
                    console.log("Company  " + permalink + " has error")
                    deferred.reject(id)
                }
            }catch(err){
                console.log("API Error")
                deferred.reject()
            }
        }else {
            console.log(error)
            deferred.reject(error)
        }

    })

    return deferred.promise
}

function processData(data){
    var deferred = q.defer(),
        newData = {}
        company = data.data

    newData.employees = company.properties


    return deferred.promise
}

function saveToDb(company){
    var deferred = q.defer()

    elasticClient.index({
        index: "ba_companies_cb_ext",
        type: 'company',
        id: company.id,
        ignoreUnavailable: true,
        allowNoIndices: true,
        body: company.data
    }, function(err) {
        if(err) {
            console.log(err)
            deferred.reject(err)
        }else
            deferred.resolve(company.id)
    })

    return deferred.promise
}



function catchCompanies(startIndex){
    var deferred = q.defer()

    var interval = setInterval(function(){
        getCompanyForIndex(startIndex)
            .then(saveToDb)
            .then(function(id){
                errorCount = 0
                console.log("Saved Company with id: " + id)
            })
            .catch(function(errorObj){
                if(errorCount == 0 || errorObj.id < errorOccurence)
                    errorOccurence = errorObj.id
                errorCount++

                if(errorCount > 10 || errorObj.error == 'Throttle limit for calls to this resource is reached.'){
                    deferred.reject()
                    clearInterval(interval)
                }
                console.log(errorObj.id + " | " + errorObj.error)
            })

        startIndex++
    },500)

    return deferred.promise
}

function getCompanyForIndex(id){
    var deferred = q.defer()
    var endpoint = "/companies/"+id+":(id,ticker,company-type,description,status,name,twitter-id,specialties,founded-year,end-year,industries,num-followers,stock-exchange,blog-rss-url,website-url,logo-url,square-logo-url,employee-count-range,locations:(contact-info:(phone1),address:(street1,city,postal-code,country-code)))"
    //var token = 'AQXvkdyLJcTfZpZud_EmaemdF01dCa58yUiXvZNAz1TrfkwOv1-o4u7vT363MlDYhLPkmOQ5Zmy8nk9PJlxWPerHh5kgUEzIPq6FX7wMDFn3484oRsprGD2bgrRYTzy98Dzi8pQB7lgMMX86vjLCtV0kw-fcEbF4zVpI_F6onGs8zI_LiPo'

    var parameters = {
        url: "https://api.linkedin.com/v1" + endpoint,
        headers: {
            'User-Agent': "hana-xs-demo-app",
            "x-li-format": "json",
            "Authorization": "Bearer " + tokens[tokenIndex].access_token
        },
        json: true,
        gzip: true
    }

    request(parameters, function (error, response, body) {
        if(body.status == 404 || body.status == 403){
            deferred.reject({
                id: id,
                error: body.message
            })
            return
        }

        body.id = id
        deferred.resolve(body)

    })

    return deferred.promise
}



function wait(ms){
    var deferred = q.defer()
    setTimeout(function(){
        deferred.resolve()
    }, ms)

    return deferred.promise
}

function catchAllCompanies(info){
    var deferred = q.defer(),
        promises = [],
        index = info.startPage
    console.log("overall " + info.pages)


    function getPage() {
        getCompanies(false, index)
            .then(updateDataset)
            .then(function(){
                if(!(index > info.pages)) {
                    index += 1
                    wait().then(getPage)
                }else{
                    deferred.resolve()
                }
            })
    }
    getPage()

    return deferred.promise
}

function updateDataset(data){
    var deferred = q.defer(),
        promises = [],
        index = 0,
        companies = data.data,
        page = data.page

    //companies.forEach(function(company){
    //    promises.push(updateCompany(company))
    //})

    var interval = setInterval(function(){
        companies[index].index = index
        promises.push(updateCompany(companies[index], page))
        index += 1

        if(index >= companies.length){
            initEnd()
            clearInterval(interval)
        }
    }, 1)

    function initEnd(){
        q.all(promises)
            .then(function(){
                console.log("Finished Saving of Page " + page)
                deferred.resolve()
            })
            .catch(function(data){
                console.log("end through error on page " + page)
                console.log(data)
                deferred.reject()
            })
    }

    return deferred.promise
}

var savedCount = 0,
    pages = {}
function updateCompany(companyid, message){
    var deferred = q.defer()

    elasticClient.update({
        index: 'ba_companies_cb',
        id: companyid,
        type: "company",
        ignoreUnavailable: true,
        allowNoIndices: true,
        body: {
            doc: {
                crawled: message ? true : false
            }
        }
    }, function(err) {
        if(err) {
            //console.log(err)
            deferred.reject(err)
        }else {
            //console.log("updated company with id: " + company.uuid + " and link " + company.properties.permalink + " with index " + company.index)
            deferred.resolve(companyid)
        }
    })

    return deferred.promise
}

function saveToFile(data){
    fs.writeFile('errorIds_'+ Date.now() +'.csv', JSON.stringify(data, null, 4), function(err) {
        if (err) throw err;
        console.log('errorfile saved');
    });
}