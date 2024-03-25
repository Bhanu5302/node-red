//----------- Here used cache memory tro store the data (Note: not yet fully tested)---------------
// use inject to trigger initially and use this code in function node
// Function to get the value of a variable path within an object
function getValueByPath(obj, path) {
    return path.split('.').reduce(function(acc, part) {
        return acc && acc[part];
    }, obj);
}

// Initialize cache in flow context if not already present
var cache = flow.get('_cache') || {};

// list of global variables
var list = ["myGlobalObject.vsecc.inputs.analog.input1","myGlobalObject2.vsecc.inputs.analog.input1"];

// expiration time for cached values (e.g 5 minutes)
var expirationTime = 5 * 60 * 1000; // 5 minutes in milliseconds

// maximum size limit for the cache (e.g 100 entries)
var maxSize = 100;

// Throttling interval (e.g., 100 milliseconds)
var throttlingInterval = 100;

// Current timestamp
var currentTime = Date.now();

// Throttle function to limit cache updates
function throttle(func, interval) {
    var lastExecutedTime = 0;
    return function() {
        var now = Date.now();
        if (now - lastExecutedTime >= interval) {
            lastExecutedTime = now;
            func.apply(this, arguments);
        }
    };
}

// Throttled function to update cache
var throttledUpdateCache = throttle(function() {
    // Check if the global object exists and list is not empty
    if (list && list.length > 0) {
        list.forEach(function(item) {
            var globalVariableName = item.split('.')[0];
            var path = item.substring(globalVariableName.length + 1);

            // Check if the value is already cached and not expired
            if (cache[item] !== undefined && cache[item].timestamp + expirationTime > currentTime) {
                var cachedValue = cache[item].value;
                var newValue = getValueByPath(global.get(globalVariableName), path);

                // Check if the value has changed
                if (cachedValue !== newValue) {
                    // Log the variable path and its old and new values
                    node.warn("Variable path '" + item + "' changed!");
                    node.warn("Old Value: " + cachedValue);
                    node.warn("New Value: " + newValue);
                    // Update cache with new value and timestamp
                    cache[item] = { value: newValue, timestamp: currentTime };
                    // Trigger a node when the specific variable path updates
                    node.send({ payload: newValue, path: item });
                }
            } else {
                // If value not cached or expired, cache it
                if (Object.keys(cache).length >= maxSize) {
                    // Evict least recently used entry if cache size exceeds maxSize
                    var lruKey = Object.keys(cache).reduce(function(prev, current) {
                        return cache[prev].timestamp < cache[current].timestamp ? prev : current;
                    });
                    delete cache[lruKey];
                }
                cache[item] = { value: getValueByPath(global.get(globalVariableName), path), timestamp: currentTime };
            }
        });

        // Update cache in flow context
        flow.set('_cache', cache);
    }
}, throttlingInterval);

// Initial cache update
throttledUpdateCache();

// Continuously update cache
setInterval(throttledUpdateCache, throttlingInterval);

// Function node handler
msg.payload = "Cache update process initialized and running continuously";
return msg;
