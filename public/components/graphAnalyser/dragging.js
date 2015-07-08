var DragDirective, InteractionHelper, app;

InteractionHelper = (function() {
    function InteractionHelper() {}

    InteractionHelper.normalisePoints = function(event) {
        event = event.touches != null ? event.touches[0] : event;
        return event = {
            pageX: event.pageX,
            pageY: event.pageY
        };
    };

    return InteractionHelper;

})();

DragDirective = function($document) {
    return {
        link: function($scope, $element, $attrs) {
            var endTypes, moveTypes, moveTypesArray, startTypes;
            endTypes = 'touchend touchcancel mouseup mouseleave';
            moveTypes = 'touchmove mousemove';
            startTypes = 'touchstart mousedown';
            moveTypesArray = moveTypes.split(' ');
            $document.bind(endTypes, function(event) {
                var i, len, results, type;
                event.preventDefault();
                results = [];
                for (i = 0, len = moveTypesArray.length; i < len; i++) {
                    type = moveTypesArray[i];
                    results.push($document.unbind(type));
                }
                return results;
            });
            return $element.bind(startTypes, function(event) {
                var elementStartX, elementStartY, interactionStart;
                event.preventDefault();
                elementStartX = parseInt($element.css('left'));
                elementStartY = parseInt($element.css('top'));
                interactionStart = InteractionHelper.normalisePoints(event);
                if (isNaN(elementStartX)) {
                    elementStartX = 0;
                }
                if (isNaN(elementStartY)) {
                    elementStartY = 0;
                }
                return $document.bind(moveTypes, function(event) {
                    var interactionCurrent;
                    event.preventDefault();
                    interactionCurrent = InteractionHelper.normalisePoints(event);
                    return $element.css({
                        left: elementStartX + (interactionCurrent.pageX - interactionStart.pageX) + 'px',
                        top: elementStartY + (interactionCurrent.pageY - interactionStart.pageY) + 'px'
                    });
                });
            });
        }
    };
};

DragDirective.$inject = ['$document'];

graphAnalyser.directive('draggable', DragDirective);