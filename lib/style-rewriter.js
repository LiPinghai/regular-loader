var postcss = require( 'postcss' );
var selectorParser = require( 'postcss-selector-parser' );
var loaderUtils = require( 'loader-utils' );
var assign = require( 'object-assign' );

var hasOwn = Object.prototype.hasOwnProperty;

function isObject( val ) {
	return val && typeof val === 'object';
}

var addId = postcss.plugin( 'add-id', function ( opts ) {
	return function ( root ) {
		root.each( function rewriteSelector( node ) {
			if ( !node.selector ) {
				// handle media queries
				if ( node.type === 'atrule' && node.name === 'media' ) {
					node.each( rewriteSelector );
				}
				return;
			}
			node.selector = selectorParser( function ( selectors ) {
				selectors.each( function ( selector ) {
					var firstNode = null;
					var node = null;

					selector.each( function ( n, i ) {
						if ( n.type !== 'pseudo' ) {
							if ( i === 0 ) {
								firstNode = n;
							}
							node = n;
						}
					} );

					selector.insertAfter( firstNode, selectorParser.attribute( {
						attribute: opts.id
					} ) );

					if ( firstNode !== node ) {
						selector.insertAfter( node, selectorParser.attribute( {
							attribute: opts.id
						} ) );
					}
				} );
			} ).process( node.selector ).result;
		} );
	};
} );

module.exports = function ( content, map ) {
	this.cacheable();

	var cb = this.async();

	var query = loaderUtils.parseQuery( this.query );
	var options = this.options.regularjs || this.options.regular || {};

	var autoprefixOptions = options.autoprefixer;
	var postcssOptions = options.postcss;

	// postcss plugins
	var plugins;
	if ( Array.isArray( postcssOptions ) ) {
		plugins = postcssOptions;
	} else if ( typeof postcssOptions === 'function' ) {
		plugins = postcssOptions.call( this, this );
	} else if ( isObject( postcssOptions ) && postcssOptions.plugins ) {
		plugins = postcssOptions.plugins;
	}
	plugins = plugins ? plugins.slice() : []; // make sure to copy it

	// scoped css
	if ( query.scoped ) {
		plugins.push( addId( {
			id: query.id
		} ) );
	}

	// autoprefixer
	if ( autoprefixOptions !== false ) {
		autoprefixOptions = assign(
			{},
			// also respect autoprefixer-loader options
			this.options.autoprefixer,
			autoprefixOptions
		);
		var autoprefixer = require( 'autoprefixer' )( autoprefixOptions );
		plugins.push( autoprefixer );
	}

	// postcss options, for source maps
	var file = this.resourcePath;
	var opts = {
		from: file,
		to: file,
		map: false
	};
	if (
		this.sourceMap &&
		!this.minimize &&
		options.cssSourceMap !== false &&
		process.env.NODE_ENV !== 'production' &&
		!( isObject( postcssOptions ) && postcssOptions.options && postcssOptions.map )
	) {
		opts.map = {
			inline: false,
			annotation: false,
			prev: map
		};
	}

	// postcss options from configuration
	if ( isObject( postcssOptions ) && postcssOptions.options ) {
		for ( var option in postcssOptions.options ) {
			if ( !hasOwn.call( opts, option ) ) {
				opts[ option ] = postcssOptions.options[ option ];
			}
		}
	}

	postcss( plugins )
		.process( content )
		.then( function ( result ) {
			// var map = result.map && result.map.toJSON()
			cb( null, result.css, map );
		} )
		.catch( function ( e ) {
			console.log( e );
			cb( e );
		} );
};