var database = require("./database.js"),
    fs                   = require('fs')

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
    var level = req.query.level
    var array = []

    fs.readFile(__dirname+"/../clusters.json", function(err, data){
        var data = JSON.parse(data)


        plainTree(aggregate1(level, data))

        res.json({ cluster: array})
    })

    function aggregate1(level, tree){
        if(level == 0){
            return tree
        }else if(tree.value){
            return {value: tree.value}
        }

        return [ aggregate1(level-1, tree.left)  ,aggregate1(level-1, tree.right)  ]
    }

    function plainTree(tree){
        if(!Array.isArray(tree))
            array.push(objectsFromTree(tree))

        if(Array.isArray(tree)){
            for(var i=0; i<tree.length; i++){
                if(Array.isArray(tree[i]))
                    plainTree(tree[i])
                else{
                    if(tree[i].value)
                        array.push(tree[i])
                    else
                        array.push(objectsFromTree(tree[i]))
                }

            }
        }
    }

    function objectsFromTree(tree){
        if(tree.value)
            return [tree]

        return objectsFromTree(tree.left).concat(objectsFromTree(tree.right))
    }

    function aggregate(level, tree){
        if(level == 0){
            return objectify( tree )
        }else if(tree.value){
            return {value: tree.value}
        }

        return [ objectify( aggregate(level-1, tree.left) ) , objectify( aggregate(level-1, tree.right) ) ]
    }

    function objectify(tree){
        if(Array.isArray(tree)){
            var arr = []
            for(var i=0; i<tree.length; i++){
                if(Array.isArray(tree[i]))
                 arr = arr.concat(objectify(tree[i]))
                else
                    arr = [ [tree[i]], arr ]
            }
            return arr
        }else if(tree.value)
            return [ { value: tree.value } ]


        return objectify(tree.left).concat(objectify(tree.right))
    }
}