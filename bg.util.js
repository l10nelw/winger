'use strict';

var ObjectArray = {

    firstWith(objects, key, value) {
        for (const object of objects) {
            if (key in object && object[key] === value) return object;
        }
    },

}