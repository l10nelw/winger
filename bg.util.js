'use strict';

var ObjectArray = {

    find(objects, prop, value) {
        for (const object of objects) {
            if (prop in object && object[prop] === value) return object;
        }
    },

}