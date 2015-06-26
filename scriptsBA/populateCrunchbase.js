var q       = require('q')
var config  = require('../config.js')
var esearch = require('elasticsearch')
var request       = require('request')

var fs = require('fs')

var company = config.company,
    crawlerIndex = config.crawlerIndex,
    metaIndex      = config.metaIndex,
    allPostsIndex = '_post_*'

var elasticClient = new esearch.Client({
    host: config.database.dev_host + ':' + config.database.port
})

var token = "def1fecedee41e6d3d6650a4f6d6de5e"

elasticClient.ping({
    requestTimeout: 1000,
    hello: "elasticsearch!"
}, function (error) {
    if (error) {
        console.log('elasticsearch cluster is down!');
    } else {
        console.log('ElasticSearch is now connected!');
        //Adding Permalinks to current dataset
        getCompanies(true, null, 65)
            .then(catchAllCompanies)
            .then(function(data){
                //console.log(JSON.stringify(data, null, 4).substring(0,2000))
                console.log("finished")
                process.exit(1)
            })
    }
})

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

function getCompanies(pages, page, startPage){
    var deferred = q.defer(),
        endpoint = ""
    if(page)
        endpoint = "/organizations?user_key=" + token + "&page=" + page
    else
        endpoint = "/organizations?user_key=" + token

    var parameters = {
        url: 'https://api.crunchbase.com/v/3' + endpoint,
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36"
        },
        json: true,
        gzip: true
    }

    request(parameters, function (error, response, body) {
        //if(body.status == 404 || body.status == 403){
        //    deferred.reject(body.status)
        //    return
        //}
        if(!error) {
            var data = body
            if(pages)
                deferred.resolve({pages: data.data.paging.number_of_pages, startPage: startPage})
            else {
                console.log("page " + page + " resolved")
                if(data.data)
                    deferred.resolve({data: data.data.items, page: page})
                else {
                    console.log("Page " + page + " has error")
                    deferred.reject(page)
                }

            }
        }else {
            console.log(error)
            deferred.reject(error)
        }

    })

    return deferred.promise
}

function wait(info){
    var deferred = q.defer()
    //console.log("Wait and restart after a minute")
    setTimeout(function(){
        //catchAllCompanies(info)
        //    .then(function(){
        //        deferred.resolve()
        //    })
        //    .catch(function(){
        //        deferred.reject()
        //    })
        deferred.resolve()
    }, 30000)

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
function updateCompany(company, page){
    var deferred = q.defer()

    elasticClient.update({
        index: 'ba_companies_cb',
        id: company.uuid,
        type: "company",
        ignoreUnavailable: true,
        allowNoIndices: true,
        body: {
            doc: {
                permalink: company.properties.permalink
            }
        }
    }, function(err) {
        if(err && err.message.indexOf('DocumentMissingException') == -1) {
            //console.log(err)
            deferred.reject(err)
        }else if(err) {
            if (pages[page])
                pages[page] = pages[page] + 1
            else
                pages[page] = 1
            deferred.resolve(company.uuid)
        }else {
            if(pages[page])
                pages[page] = pages[page] + 1
            else
                pages[page] = 1
            savedCount += 1
            if(savedCount > 10000){
                console.log("saved 10000")
                console.log(pages)
                savedCount = 0
            }

            //console.log("updated company with id: " + company.uuid + " and link " + company.properties.permalink + " with index " + company.index)
            deferred.resolve(company.uuid)
        }
    })

    return deferred.promise
}
function saveToDb(company, index){
    var deferred = q.defer()
    elasticClient.index({
        index: "ba_companies_cb",
        type: 'company',
        id: company.crunchbase_uuid,
        ignoreUnavailable: true,
        allowNoIndices: true,
        body: company
    }, function(err) {
        if(err) {
            deferred.reject({id: company.crunchbase_uuid, error: err})
        }else
            deferred.resolve(company.name + " " + index)
    })

    return deferred.promise
}

function saveToFile(data){
    fs.writeFile('errorIds_'+ Date.now() +'.csv', JSON.stringify(data, null, 4), function(err) {
        if (err) throw err;
        console.log('errorfile saved');
    });
}