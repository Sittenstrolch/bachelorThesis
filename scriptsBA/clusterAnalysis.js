var fs      = require('fs')

fs.readFile(__dirname + "/../clusters.json", function(err, data){
    data = JSON.parse(data)

    var levels = depth(data)
    console.log( "Tree depth: " + levels)

    //distributions(levels, data)

})

function depth(tree){
    if(tree.value)
        return 1

    return 1 + max(depth(tree.left), depth(tree.right))
}

function max(a,b){if(a>b){return a}else{return b}}

function distributions(levels, tree){
    var array = []



    for(var i=0; i<levels; i++){
        plainTree(aggregate1(i, JSON.parse(JSON.stringify(tree))) )
        var normalized = []
        //Normalize Cluster to all be an object containing size and values
        for(var j=0; j<array.length; j++){
            var cluster = {}
            cluster.group = 0
            if(Array.isArray(array[j]) ) {
                cluster.size = array[j].length
                cluster.values = array[j]
            }else {
                cluster.size = 1
                cluster.values = [array[j]]
            }
            normalized.push(cluster)


        }

        //console.log("Level " + i + " has " + normalized.length + " clusters" )

        normalized.sort(function(a,b){return b.size - a.size})
        console.log( getCloseness(normalized) )

        array = []
    }

    function getCloseness(clusters){
        var dist = 0

        for(var i=0; i<clusters.length-1; i++){
            var diff = Math.abs(clusters[i].size - clusters[i+1].size)
            dist += diff
            //if(diff > 0)
            //    dist = diff
        }

        return dist / clusters.length
    }

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
}

