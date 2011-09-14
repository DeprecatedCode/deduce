# Deduce

Deduce is a simple [mutable](http://github.com/NateFerrero/mutable) module for Node. It follows a specified path into an object chain, asyncronously when possible, eventually reaching a conclusion.

## Sample Usage

    var deduce = require('deduce').instance();
    
    var sounds = {
        animals: {
            mammals: {
                cat: 'Meow',
                dog: {
                    $index: 'Woof',
                    little: 'Yip',
                    big: 'Grrrrrowl'
                }
            }
        },
        keys: function(callback) { callback('Jingle'); }
    }

    deduce.resolve( sounds, 'animals/mammals/dog' )
        .end( console.log )
        .error( console.error );

    deduce.resolve( sounds, 'keys' )
        .end(
            function( snd ) {
                console.log( 'Keys make the noise:', snd ); 
            }
        )
        .error( function(err) { throw err; } );
