import * as Winfo from './winfo.js';

export async function onExternalRequest(request) {
    switch (request.type) {
        case 'info': {
            // Return winfos with the specified `properties` (required)
            // If `windowIds` (optional) given, return only the winfos for them
            const { properties } = request;
            if (!Array.isArray(properties))
                return Promise.reject(new Error('`properties` array is required'));
            const { windowIds } = request;
            if (windowIds && !windowIds.every?.(Number.isInteger))
                return Promise.reject(new Error('`windowIds` must be an array of integers'));
            return Winfo.getAll(properties, windowIds?.map( id => ({ id }) ));
        }
    }
    return Promise.reject(new Error('Missing or unrecognized `type`'));
}
