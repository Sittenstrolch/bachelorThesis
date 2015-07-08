graphAnalyser.provider('ba_graphProvider', function(){

    function _graphProvider($http, $q) {
        this.graphData = function(level, links){
            var deferred = $q.defer()

            //$http.get("/data.json", [])
            //    .success(function(data){
            //        deferred.resolve(data)
            //    })
            var _level = 62
            var _links = 5
            if(level != null)
                _level = level
            if(links != null)
                _links = links

            $http.get("/api/clusters", {params: {level: _level, linksPerCluster: _links}})
                .success(function(data){
                    deferred.resolve(data)
                })


            return deferred.promise
        }

        this.posts = function(from, to){
            var deferred = $q.defer()

            $http.get("/api/posts", {params: {from: from, to: to}})
                .success(function(posts){
                    deferred.resolve(posts)
                })

            return deferred.promise
        }

    }

    this.$get = ['$http','$q', function($http, $q) {
        return new _graphProvider($http, $q);
    }];

})

