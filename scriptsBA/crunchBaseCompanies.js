var q       = require('q')
var format  = require('string-format')
var config  = require('../config.js')
var esearch = require('elasticsearch')
var request       = require('request')

var json2csv = require('json2csv');
var fs = require('fs')

var company = config.company,
    crawlerIndex = config.crawlerIndex,
    metaIndex      = config.metaIndex,
    allPostsIndex = '_post_*'

var elasticClient = new esearch.Client({
    host: config.database.host + ':' + config.database.port
})

var tokens = [
    {access_token: 'AQW0kwj0LMqgqU_f5k9jXJFTxpzbjwzzBSEwI1KN5s5AYTCb--8V2Dp2AAr2U-T70dCk9WVHterfkZuKuqQLt23IvAzNjx1MvkQIT40W6xJp7CK_6Cegp7g36-PfkvarHuThSPy0Ew5oOvj0tLpzQOrBUFAH2EqLnBs6vTSIBxmharrXt8w'},
    {access_token: 'AQW0ieQKTUhDgOXBMjTNIlTegeLHgzzTkRGeAisVKv1B1n-TxtxEwC2HIeTPrwGMfqbfw-t5dGaD6QdFbI3wpxZpQuT7MKAzGbwnCwxaIp6-eAmJeRdnGipVndw7ezidlruY8St5cJw4jwbJ8uOYb6MZ-iAa4z2sxmcfZZgaXQtRO2Dm1u0'},
    {access_token: 'AQXSZO3Uyek-Jix-w94pm-S2iUa9A4xRhAccDmQ3YT2JH4eDOEMfS3Q-GxDOcDF8xTDz1Lgf9fbQG1q3tMTMDs1cqFNQIJKkw5F90z3rnkyXTRn0f3mU1fCn2SztLTiJSmEVCaaipt37ax01kd2ef3yXKv2eywgqWIdTSMUWBJXueHewDB4'},
    {access_token: 'AQUjJ8SrejxY1k1sDIjd6Kgu_l5a8ieDrTqL7TGdzHaU1ai6lE8ABtqQ6xRR8iJNnq-qVmD3LhtoNu-5f2uE47XjUffUQXmSOfVoIug3x7spgM5xeAiaxrzUHUKo4d48ylx3Awi-bTjGCgyEklWZt-YHdHX3BlYWsShpr1OR8LGq_M7RB0c'},

    {access_token: 'AQUAIyNliyMDToGg40jKM5G9NmVN7Ygd1Kioya-eXXlQM2flzi4Y6cUtM2YjZffOQOA29soI6v2H6r_MazS-M-HgJC8gYvzwcHMbQ8PW3t7tEEG8tiWAuWO-YEv63HupcYx1XTZ5mxn_atKEdQBN7j2F7YxjmyxpygzB1sPT2gZtbtUO13s'},
    {access_token: 'AQVE0tywHdt11wbfL7BEUqOPL_JbqykT5O0A1BAS5CyF33LKh2cjH-vCzd0KsOIm-fR5Ql2E51maV2PmXBmcotlnyXusJHSLpx_TYludABXlCM6LGSNMOY2XGokLmoLM7FfF7DcFQInVWhHeCm3IRpjHHE6nsmObRAqq0wMdh2QQ3iBBz28'},
    {access_token: 'AQVLZlRZqsXJmezU2F3lCrJYp3m2LrCATSdnnuS6CyL6iLIDJJs7amAY_wFwNLdxGV3njO_s4Ba20NR2gZ95K37_a2g-U94JBNiScQB0w6cqXAsltVQrTdldHL6NE6dwdPAW7wAmXzqtgAPqhEiq2z3lcXRPVwXAbT5m0mxbzqqUIVZbjI0'}
]

var errorIds= {
    ids: []
}

var errorCount = 0,
    errorOccurence = 0

var tokenIndex = 0,
    g_startIndex = 5376

elasticClient.ping({
    requestTimeout: 1000,
    hello: "elasticsearch!"
}, function (error) {
    if (error) {
        console.log('elasticsearch cluster is down!');
    } else {
        console.log('ElasticSearch is now connected!');
        fs.readFile('organizations.json', 'utf8', function read(err, data) {
            if (err) {
                throw err;
            }
            if(!err) {
                var orgs = JSON.parse(data);
                console.log(orgs.root.length)
                var i=266032
                var interval = setInterval(function(){
                    saveToDb(orgs.root[i], i)
                        .then(function(name){
                            console.log("saved " + name + " to db")
                        })
                        .catch(function(err){
                            console.log("Error: " + err.error)
                        })
                    i += 1
                    if(i>orgs.root.length)
                        clearInterval(interval)
                },1)


            }

        });


    }
})


function createNewIndex(indexName, numberOfShards) {
    var deferred = q.defer()


    elasticClient.indices.create({
        index: indexName,
        ignore_conflicts: true
    }).then(function (r) {
        //create mapping
        console.log("done")
        deferred.resolve(indexName)

    }).catch(function(err){
        console.log(err)
        deferred.reject()
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

function restartCrawling(){
    if(tokenIndex == (tokens.length - 1)) {
        fs.readFile('tokens.json', 'utf8', function read(err, data) {
            if (err) {
                throw err;
            }
            if(!err) {
                tokens = tokens.concat(JSON.parse(data));
            }

            console.log("Wait for 5minutes and restart again at " + errorOccurence)
            fs.writeFile('lastIndex.json', JSON.stringify({lastIndex: errorOccurence}, null, 4), function(err) {
                if (err) throw err;
                console.log('Occurencefile saved');
            });

        });

        setTimeout(function () {
            errorCount = 0
            tokenIndex = 0
            g_startIndex = errorOccurence
            catchCompanies(g_startIndex)
                .catch(restartCrawling)
        }, 300000)
    }else{
        console.log("Get next token and restart at id: " + errorOccurence)
        errorCount = 0
        g_startIndex = errorOccurence
        tokenIndex += 1
        catchCompanies(g_startIndex)
            .catch(restartCrawling)
    }
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