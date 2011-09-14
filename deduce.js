/**
 * Deduce
 * An asynchronous variable resolution engine.
 * 
 * This is a mutable module! Please submit your custom mutations to the Node
 * community.
 * 
 * By: Nate Ferrero
 * On: Sept 8, 2011
 * In: Raleigh, NC
 */
 
/**
 * Quick How-To Guide:
 * 
 * var deduce = require('deduce').instance();
 * 
 * var sample = {foo: {bar: 'Baz', $index: 'Hello'}};
 * 
 * function show(result) {
 *   console.log(result);
 * }
 * 
 * deduce.resolve(sample, ['foo', 'bar']).on('end', show);
 * // Console: Baz
 * 
 * deduce.resolve(sample, 'foo/yam').end(show).error(console.error);
 * // Console: Hello
 * 
 * For more details, see the README.md file.
 */
 
// Mutable module
var $ = require('mutable')(module);

// Mutable Exports
module.mutable.exports('resolve');

// Require EventEmitter
$.EventEmitter = require('events').EventEmitter;

// Object index property name
$.IndexPropertyName = '$index';

// Error handler property name
$.ErrorPropertyName = '$error';

// Context Path Not Array Error
$.PathNotArrayError = new Error('Whoa, context.path is not an Array');

// Not Found Error
$.NotFoundError = new Error('Path could not be resolved on target.');

// Provide an answer or handle error
$.answer = function answer(target, context) {
    if(target instanceof Error)
        $.resolveError(target, context);
    else
        context.events.emit('end', target);
};

// Main entry point, pass a context or path, then listen to the promise
$.resolve = function resolve(target, context) {

    // Create context if needed
    switch(typeof context) {
        case 'function':
            context = context();
            return $.resolve(target, context);
        case 'object':
            break;
        case 'array':
            context = {path: context};
            break;
        case 'string':
            context = context.split('/');
            if(context[0] === '')
                context.shift();
            context = {path: context};
            break;
        default:
            context = {};
    }
    
    // Ensure path is an array
    if( !(context.path instanceof Array) )
        throw $.PathNotArrayError;
    
    // Create context argument function
    if(typeof context.arg != 'function')
        context.arg = $.contextArgFunction(context);
        
    // Create context restore argument function
    if(typeof context.unarg != 'function')
        context.unarg = $.contextUnArgFunction(context);
        
    // Create deduction chain
    context.chain = [];
    
    // Start Resolve
    $.resolveNextTick(target, context);
    
    // Create an event emitter and return it
    context.events = new $.EventEmitter();
    
    // Extend it with an end listener
    context.events.end = $.contextEndListenerFunction(context);
    
    // Extend it with an error listener
    context.events.error = $.contextErrorListenerFunction(context);
    
    return context.events;
};

// End listener
$.contextEndListenerFunction = function contextEndListenerFunctionGenerator(context) {
    return function contextEndListener(callback) {
        context.events.on('end', callback);
        return context.events;
    };
};

// Error listener
$.contextErrorListenerFunction = function contextErrorListenerFunctionGenerator(context) {
    return function contextErrorListener(callback) {
        context.events.on('error', callback);
        return context.events;
    };
};

// Context argument function generator
$.contextArgFunction = function contextArgFunctionGenerator(context) {
    return function contextArg() {
        return context.path.shift();
    };
};

// Context argument function generator
$.contextUnArgFunction = function contextUnArgFunctionGenerator(context) {
    return function contextUnArg(segment) {
        return context.path.unshift(segment);
    };
};

// Resolve on next tick
$.resolveNextTick = function resolveNextTickGenerator(target, context) {
    process.nextTick(function resolveNextTick() {
        
        // Save to the deduction chain, backtraced on error
        context.chain.push({target: target, context: context});
    
        $.resolveType(typeof target)(target, context);
    });
};

// Choose the function to resolve
$.resolveType = function resolveTypeGenerator(type) {
    return $['resolve' + type[0].toUpperCase() + type.slice(1)];
};

// If we reached a string or number, we are done
$.resolveString = $.resolveNumber = function resolveStringOrNumber(target, context) {
    $.answer(target, context);
};

// Evaluate functions asynchronously
$.resolveFunction = function resolveFunction(target, context) {
    try {
        target($.resolveFunctionCallback(context), context);
    } catch(err) {
        $.answer(err, context);
    }
};

// The function callback closure
$.resolveFunctionCallback = function resolveFunctionCallbackGenerator(context) {
    return function resolveFunctionCallback(target, alt) {
        
        // Allow for null to support callback(err, value); without an error
        if(target === null) target = alt;
        
        $.resolveNextTick(target, context);
    };
};

// Test for a void segment, indicating the end of the chain
$.testVoidSegment = $.testVoidVariable = function testVoidVariable(v) {
    return v === null || typeof v == 'undefined' || v === false;
};

// Resolve objects and arrays
$.resolveObject = $.resolveArray = function resolveObjectOrArray(target, context) {
    
    // Go one segment deeper into path
    var segment = context.arg();
    
    // If we are at the end of the path, stop and answer
    if(target instanceof Error || $.testVoidSegment(segment)) {
        $.answer(target, context);
        return;
    }
    
    // If segment property exists
    if(!$.testVoidVariable(target[segment])) {
        $.resolveNextTick(target[segment], context);
        return;
    }
    
    // Restore path if no match so far
    context.unarg(segment);
    
    // If index property exists
    if(!$.testVoidVariable(target[$.IndexPropertyName])) {
        $.resolveNextTick(target[$.IndexPropertyName], context);
        return;
    }
    
    // No valid match found
    $.answer($.NotFoundError, context);
};

// Resolve to the deepest error handler possible
$.resolveError = function resolveError(err, context) {
    
    // If already errored, stop
    if(typeof context.error === 'object')
        throw err;
    
    // Save the error in the context
    context.error = err;
    
    // Iterate backwards up the chain and find the closest error handler
    for(var i = context.chain.length - 1; i >= 0; i--) {
        var target = context.chain[i].target;
        if(typeof target != 'undefined' && !$.testVoidVariable(target[$.ErrorPropertyName])) {
            $.resolveNextTick(target[$.ErrorPropertyName], context);
            return;
        }
    }
    
    // No error handler found
    context.events.emit('error', err);
};