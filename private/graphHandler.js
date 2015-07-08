var database = require("./database.js"),
    fs                   = require('fs'),
    companyCluster  = require(__dirname + '/../companyCluster.js')

exports.graph = function(req, res){
    database.getAllCompanies()
        .then(function(nodes){
            console.log("companies fetched ")
            //
            var index = 0,
                links = [],
                indices = []

            for(var j=0; j<nodes.length; j++){
                indices.push(nodes[j].name)
            }

            nodes = nodes.slice(0,300)

            function getLinks(){
                database.getLinksForCompany(nodes[index].name, index)
                    .then(function(_links){
                        for(var i=0; i<_links.length; i++){
                            if(typeof _links[i].source === "string"){
                                _links[i].source = indices.indexOf(_links[i].source)
                            }else{
                                _links[i].target = indices.indexOf(_links[i].target)
                            }

                            if(_links[i].target >= nodes.length-1 || _links[i].source >= nodes.length-1) {
                                _links.splice(i, 1)
                                i = i-1
                            }
                        }

                        links = links.concat(_links)
                        index = index + 1

                        if(index == nodes.length -1) {
                            res.json({nodes: nodes, links: links}).send(200)
                        }else{
                            updateProgress(index, nodes.length, "Getting links for companies... ")
                            getLinks()
                        }
                    })
            }

            getLinks()


        })
}

exports.linksForCompany = function(req, res){
    database.getLinksForCompany(req.query.companyId)
        .then(function(links){
            res.json({links: links}).send(200)
        })
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

exports.clusters = function(req, res){
    var level = req.query.level,
        numberOfLinks = req.query.linksPerCluster

    database.clusters(level)
        .then(function(cluster){
            //for(var i=0; i<cluster.length; i++){
            //    if(cluster[i].values.length == 1){
            //        cluster.splice(i,1)
            //        i = i-1
            //    }
            //}
            var links = []
            if(numberOfLinks > 0)
                links = calcClusterLinks(cluster.slice(0), numberOfLinks)

            res.json({nodes: cluster.sort(function(a,b){return b.size - a.size}), links: links})
        })
}

function calcClusterLinks(clusters, numberOfLinks){
    var links = [],
        isRunning = true,
        index = 0
    try {
        while (isRunning) {
            updateProgress(index, clusters.length, "Generating clusterlinks... ")

            if (clusters.length == 1) {
                isRunning = false
                return links
            }

            var cluster = clusters.shift(),
                distance = 0,
                clusterLinks = []

            for (var i = 0; i < clusters.length; i++) {
                var cDistance = clusterDistance(cluster, clusters[i])
                if(cDistance < 7)
                    clusterLinks.push({
                        source: index,
                        target: (i + index + 1),
                        value: cDistance
                    })
            }

            clusterLinks.sort(function(a,b){return a.value - b.value})

            links = links.concat(clusterLinks.slice(0,numberOfLinks))
            index = index + 1
        }
    }catch(err){
        console.log(err)
    }
}

function clusterDistance(cluster1, cluster2){
    var distanceSum = 0

    for(var i=0; i<cluster1.values.length; i++){
        updateProgress(i, cluster1.values.length, "Calculating... ")
        for(var j=0; j<cluster2.values.length; j++){
            distanceSum += calcDistance(cluster1.values[i].value, cluster2.values[j].value)
        }
    }

    return Math.round( ( distanceSum / (cluster1.values.length * cluster2.values.length) ) * 10 )
}

function calcDistance(company1, company2){
    return companyCluster.compare(company1, company2)
}


exports.getPosts = function(req, res){
    var from = req.query.from,
        until = req.query.to
    database.getPosts(from, until)
        .then(function(posts){
            res.json(posts)
        })
}