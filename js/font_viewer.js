const Viewer = ( { domContainer, json } ) =>
{
	let width = 1;
	let height = 1;
	let shadowIndex = 0;
	
	const image = new Image();
	
	const canvas = document.createElement( 'canvas' );
		  canvas.width = width;
		  canvas.height = height;

	const context = canvas.getContext( '2d' );
		  context.imageSmoothingEnabled = true;
		  context.imageSmoothingQuality = 'high';
		  
	const elementList = [];
	const events = { loaded:new signals.Signal() };
	const paper = Snap( width, height );
		  paper.clear();
		  paper.attr( { 'xmlns:xlink':'http://www.w3.org/1999/xlink' } );
							
	const root = paper.g();
	const background = root.g();
	const objects = root.g();

	const setFillAttributes = ( element, backgroundElement, attrs ) => 
	{
		if( element && attrs != null && ( attrs.hasOwnProperty( 'fillType' ) || attrs.hasOwnProperty( 'fillColors' ) ) )
		{
			let fillType = element.data().fillType;
			
			if( attrs.hasOwnProperty( 'fillType' ) )
			{
				fillType = attrs.fillType;
				
				element.data().fillType = fillType;
			}
			
			if( attrs.hasOwnProperty( 'fillColors' ) )
			{
				if( fillType == 'solid' )
				{
					element.data().solidFillColor = Snap.getRGB( attrs.fillColors[ 0 ] ).hex;
				}
				else if( fillType == 'radial' || fillType == 'linear' )
				{
					const gradientElement = ( fillType == 'radial' ) ? element.data().radialGradient : element.data().linearGradient;
					
					gradientElement.selectAll( 'stop' ).items.forEach( ( stopElement, stopIndex ) => 
					{
						if( stopIndex < 2 )
							stopElement.attr( { stopColor:Snap.getRGB( attrs.fillColors[ stopIndex ] ).hex } );
					} );
				}
			}

			let fill = null;
			
			if( fillType == 'solid' )
				fill = element.data().solidFillColor;
			else if( fillType == 'linear' )
				fill = element.data().linearGradient;
			else if( fillType == 'radial' )
				fill = element.data().radialGradient;

			if( backgroundElement )
				backgroundElement.attr( { fill } );
		}
	};

	const createShadowFilter = ( element ) =>
	{
		element.data().shadowAttributes = {};
		element.data().shadowUUIDList = [];
		
		element.data().shadowFilter = paper.filter( '' ).attr( { x:'-100%', y:'-100%', width:'300%', height:'300%', filterUnits:'objectBoundingBox' } );
		element.data().shadowFilter.append( Snap.parse( '<feMerge />' ) );
	};
	
	const setShadowAttributes = ( element, shadowUUID, attrs ) => 
	{
		if( element && element.data().shadowUUIDList.indexOf( shadowUUID ) != -1 && attrs != null && 
			( attrs.hasOwnProperty( 'blur' ) || attrs.hasOwnProperty( 'color' ) || attrs.hasOwnProperty( 'distance' ) || attrs.hasOwnProperty( 'rotation' ) || attrs.hasOwnProperty( 'opacity' ) ) )
		{
			let blur = element.data().shadowAttributes[ shadowUUID ].blur;
			let color = element.data().shadowAttributes[ shadowUUID ].color;
			let distance = element.data().shadowAttributes[ shadowUUID ].distance;
			let rotation = element.data().shadowAttributes[ shadowUUID ].rotation;
			let opacity = element.data().shadowAttributes[ shadowUUID ].opacity;
			
			if( attrs.hasOwnProperty( 'blur' ) )
			{
				blur = parseInt( attrs.blur );
				element.data().shadowAttributes[ shadowUUID ].blur = blur;
			}

			if( attrs.hasOwnProperty( 'color' ) )
			{
				color = Snap.getRGB( attrs.color ).hex;
				element.data().shadowAttributes[ shadowUUID ].color = color;
			}
			
			if( attrs.hasOwnProperty( 'distance' ) )
			{
				distance = parseFloat( attrs.distance );
				element.data().shadowAttributes[ shadowUUID ].distance = distance;
			}
			
			if( attrs.hasOwnProperty( 'rotation' ) )
			{
				rotation = parseInt( attrs.rotation );
				element.data().shadowAttributes[ shadowUUID ].rotation = rotation;
			}
			
			if( attrs.hasOwnProperty( 'opacity' ) )
			{
				opacity = parseFloat( attrs.opacity );
				element.data().shadowAttributes[ shadowUUID ].opacity = opacity;
			}
				
			const dx = Math.sin( rotation / 180 * Math.PI ) * distance;
			const dy = Math.cos( rotation / 180 * Math.PI ) * distance;
		
			const shadowFilter = element.data().shadowFilter;

			shadowFilter.select( 'feGaussianBlur[result=blur_' + shadowUUID + ']' ).attr( { stdDeviation:blur } );
			shadowFilter.select( 'feFlood[result=color_' + shadowUUID + ']' ).attr( { floodColor:color } );
			shadowFilter.select( 'feOffset[result=offsetblur_' + shadowUUID + ']' ).attr( { dx, dy } );	
			shadowFilter.select( 'feComponentTransfer[result=shadow_' + shadowUUID + ']' ).select( 'feFuncA' ).attr( { slope:opacity } );
			
			return true;
		}
		
		return false;
	};
	
	const addShadow = ( element, attrs = null ) =>
	{
		if( element )
		{
			const shadowUUID = ++shadowIndex;

			element.data().shadowFilter.append( Snap.parse
			( 
				'<feGaussianBlur in="SourceAlpha" result="blur_' + shadowUUID + '"/>' +
				'<feOffset in="blur_' + shadowUUID + '" result="offsetblur_' + shadowUUID + '" />' +
				'<feFlood result="color_' + shadowUUID + '" />' +
				'<feComposite in="color_' + shadowUUID + '" in2="offsetblur_' + shadowUUID + '" operator="in" result="shadow_' + shadowUUID + '"/>' +
				'<feComponentTransfer in="shadow_' + shadowUUID + '" result="shadow_' + shadowUUID + '"><feFuncA type="linear" slope="0.5"/></feComponentTransfer>'
			) );
		
			const shadowFilter = element.data().shadowFilter;
			const feMerge = shadowFilter.select( 'feMerge' );
			
			feMerge.append( Snap.parse( '<feMergeNode in="shadow_' + shadowUUID + '" />' ) );
			
			shadowFilter.append( feMerge );
			
			element.data().shadowAttributes[ shadowUUID ] = {};	
			element.data().shadowUUIDList.push( shadowUUID );
			
			setShadowAttributes
			( 
				element, 
				shadowUUID, 
				attrs || { 
					blur:2, 
					distance:8, 
					rotation:45, 
					color:'#000000', 
					opacity:0.5 
				} 
			);
			
			element.data().graphics.attr( { visibility:'visible' } );

			return shadowUUID;
		}
		
		return null;
	};
	
	const setLinearGradientAttributes = ( element, attrs ) =>
	{
		if( element && attrs != null && attrs.hasOwnProperty( 'fillRotation' ) )
		{
			const rotation = parseInt( attrs.fillRotation );
			const x = Math.sin( rotation / 180 * Math.PI );
			const y = Math.cos( rotation / 180 * Math.PI );
			const d = Math.sqrt( x * x + y * y ) * 0.5;
			const x1 = 0.5 + x * d;
			const y1 = 0.5 + y * d;
			const x2 = 0.5 - x * d;
			const y2 = 0.5 - y * d;
			
			element.data().fillRotation = rotation;
			element.data().linearGradient.attr( { x1, y1, x2, y2 } );
		}
	};
	
	const getAttributes = ( element ) => 
	{
		const attrs = {};

		attrs.type = element.data().type;

		if( attrs.type == 'textLine' || attrs.type == 'textOnCircle' )
		{								
			attrs.text = element.data().text;
			attrs.maxChars = element.data().maxChars;
			attrs.fontSize = element.data().fontSize;
			attrs.fontFamily = element.data().fontFamily;
			attrs.opacity = element.data().opacity;
			attrs.fillType = element.data().fillType;
			attrs.fillRotation = element.data().fillRotation;
			attrs.fillColors = [];
			
			if( attrs.fillType == 'solid' )
			{
				attrs.fillColors.push( Snap.getRGB( element.data().solidFillColor ).hex );
			}
			else if( attrs.fillType == 'radial' || attrs.fillType == 'linear' )
			{
				const gradientElement =  ( attrs.fillType == 'radial' ) ? element.data().radialGradient : element.data().linearGradient;

				gradientElement.selectAll( 'stop' ).items.forEach( stopElement => attrs.fillColors.push( Snap.getRGB( stopElement.attr( 'stopColor' ) ).hex ) );
			}
		}
		
		if( attrs.type == 'textLine' )
		{
			attrs.textWidth = element.data().textWidth;
		}
		
		if( attrs.type == 'textOnCircle' )
		{
			attrs.radius = element.data().radius;
			attrs.arcLength = element.data().arcLength;
		}

		return attrs;
	};
						
	const setAttributes = ( element, attrs ) => 
	{
		const type = element.data().type;

		let backgroundElement = null;

		if( type == 'textOnCircle' )
		{
			const pathElement = element.selectAll( 'path' ).items[ 0 ];
			
			backgroundElement = element.selectAll( 'circle' ).items[ 0 ];
			
			let needsUpdate = false;
			let radius = element.data().radius;
			let arcLength = element.data().arcLength;
			let text = element.data().text;
			let maxChars = element.data().maxChars;
			let fontSize = element.data().fontSize;
			let fontFamily = element.data().fontFamily;
			
			if( attrs != null && ( attrs.hasOwnProperty( 'radius' ) || attrs.hasOwnProperty( 'arcLength' ) || attrs.hasOwnProperty( 'text' ) ||
				attrs.hasOwnProperty( 'maxChars' ) || attrs.hasOwnProperty( 'fontSize' ) || attrs.hasOwnProperty( 'fontFamily' ) ) )
			{	
				if( attrs.hasOwnProperty( 'radius' ) )
				{
					radius = Math.max( 30, Math.min( 450, attrs.radius ) );
					element.data().radius = radius;
					needsUpdate = true;
				}
				
				if( attrs.hasOwnProperty( 'arcLength' ) )
				{
					arcLength = Math.max( 90, Math.min( 350, attrs.arcLength ) );
					element.data().arcLength = arcLength;
					needsUpdate = true;
				}
				
				if( attrs.hasOwnProperty( 'text' ) )
				{							
					text = attrs.text;
					element.data().text = text;
					needsUpdate = true;
				}
				
				if( attrs.hasOwnProperty( 'maxChars' ) )
				{
					maxChars = Math.max( 0, Math.min( 100, attrs.maxChars ) );
					element.data().maxChars = maxChars;
					needsUpdate = true;
				}
				
				if( attrs.hasOwnProperty( 'fontSize' ) )
				{
					fontSize = Math.max( 12, Math.min( 192, attrs.fontSize ) );
					element.data().fontSize = fontSize;
					needsUpdate = true;
				}
				
				if( attrs.hasOwnProperty( 'fontFamily' ) )
				{
					fontFamily = attrs.fontFamily;
					element.data().fontFamily = fontFamily;
					needsUpdate = true;
				}							 

				if( maxChars > 0 && text.length > maxChars )
				{
					text = text.substr( 0, maxChars );
					needsUpdate = true;
				}
				
				if( needsUpdate )
				{							
					element.data().mask.clear();
					element.data().graphics.clear();
						
					const textAttrs = 
					{
						textAnchor:'left',
						fontSize:element.data().fontSize,
						fontFamily:'"' + element.data().fontFamily + '"',
						fill:'white',						
					};

					let textElement = element.text( 0, 0, 'M' ).attr( textAttrs );
						textElement.node.setAttributeNS( 'http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve' );
						
					const charBBox = textElement.getBBox( true );
					
					if( radius - charBBox.height < 0 )
						radius = charBBox.height;
						
					const pathRadius = radius - charBBox.height + charBBox.y2;
					const pathStartAngle = ( 90 + ( 360 - arcLength ) / 2 ) * Math.PI / 180;
					const pathArcLength = arcLength * Math.PI / 180;

					backgroundElement.attr( { r:radius } );
			
					element.data().path = getEllipticalArcPath( 0, 0, pathRadius, pathRadius, pathStartAngle, pathArcLength, 0 );
					pathElement.attr( { d:element.data().path, stroke:'none' } );						
					
					textElement.attr( { text } );

					const pathLength = pathElement.getTotalLength();
					
					let charScale = 1.0;
					let textLength = 0;
					let textLength2 = 0;
					let spacesNum = 0;
					
					text.split( '' ).forEach( char => 
					{
						textElement.attr( { text:char } );

						const charBBox = textElement.getBBox( true );

						textLength += charBBox.w + charBBox.x;
						
						if( !Array.isArray( char.match( /\s/g ) ) )
							textLength2 += charBBox.w + charBBox.x;
						else
							spacesNum++;
					} );

					const spaceWidth = ( textLength - textLength2 ) / spacesNum;

					if( textLength > pathLength )
					{
						charScale = pathLength / textLength;
						textLength = pathLength - 1;
					}
					
					textElement.remove();
					textElement = null;
					
					let isSpaceChar;
					let pathPosition = ( pathLength - textLength ) / 2;
					
					text.split( '' ).forEach( char => 
					{
						const charElement = element.text( 0, 0, char ).attr( textAttrs );
						const charBBox = charElement.getBBox( true );
						
						isSpaceChar = Array.isArray( char.match( /\s/g ) );
						
						if( isSpaceChar )
						{
							charBBox.w = spaceWidth;
							charBBox.cx = spaceWidth / 2;
						}
					
						const matrix = new Snap.Matrix();
						const position = Math.max( 0, pathPosition + charBBox.x * charScale );
						const pathPoint = pathElement.getPointAtLength( position );
						const pathPoint2 = pathElement.getPointAtLength( pathPosition + charBBox.cx * charScale );
						
						pathPosition += charBBox.w * charScale + charBBox.x * charScale;
						
						matrix.translate( pathPoint.x, pathPoint.y );
						matrix.rotate( pathPoint2.alpha + 180 ).scale( charScale, 1 );
						
						charElement.transform( matrix );
						element.data().mask.append( charElement );
						
						if( !isSpaceChar )
						{
							const charElement2 = element.text( 0, 0, char )
								.attr( textAttrs )
								.transform( matrix );
							
							element.data().graphics.append( charElement2 );
						}
					} );

					const pathStart = pathElement.getPointAtLength( 0 );
					const pathEnd = pathElement.getPointAtLength( pathElement.getTotalLength() );
					
					element.data().pathStartX = pathStart.x;
					element.data().pathStartY = pathStart.y;
					element.data().pathEndX = pathEnd.x;
					element.data().pathEndY = pathEnd.y;
				}
			}
			else 
			{
				pathElement.attr( { d:element.data().path, stroke:'none' } );
			}
		}
		else if( type == 'textLine' )
		{
			backgroundElement = element.selectAll( 'rect' ).items[ 0 ];
			
			let needsUpdate = false;
			let text = element.data().text;
			let maxChars = element.data().maxChars;
			let textWidth = element.data().textWidth;
			let fontSize = element.data().fontSize;
			let fontFamily = element.data().fontFamily;
			
			if( attrs != null&& ( attrs.hasOwnProperty( 'text' ) || attrs.hasOwnProperty( 'textWidth' ) || attrs.hasOwnProperty( 'maxChars' ) || 
				attrs.hasOwnProperty( 'fontSize' ) || attrs.hasOwnProperty( 'fontFamily' ) ) )
			{
				if( attrs.hasOwnProperty( 'text' ) )
				{							
					text = attrs.text;
					element.data().text = text;
					needsUpdate = true;
				}
				
				if( attrs.hasOwnProperty( 'maxChars' ) )
				{
					maxChars = Math.max( 0, Math.min( 100, attrs.maxChars ) );
					element.data().maxChars = maxChars;
					needsUpdate = true;
				}
				
				if( attrs.hasOwnProperty( 'textWidth' ) )
				{
					textWidth = Math.max( 60, Math.min( 600, attrs.textWidth ) );
					element.data().textWidth = textWidth;
					needsUpdate = true;
				}
				
				if( attrs.hasOwnProperty( 'fontSize' ) )
				{
					fontSize = Math.max( 12, Math.min( 192, attrs.fontSize ) );
					element.data().fontSize = fontSize;
					needsUpdate = true;
				}
				
				if( attrs.hasOwnProperty( 'fontFamily' ) )
				{
					fontFamily = element.data().fontFamily = attrs.fontFamily;
					needsUpdate = true;
				}

				if( maxChars > 0 && text.length > maxChars )
				{
					text = text.substr( 0, maxChars );
					needsUpdate = true;
				}

				if( needsUpdate )
				{
				
					element.data().mask.clear();
					element.data().graphics.clear();

					const textAttrs = 
					{
						textAnchor:'middle',
						alignmentBaseline:'alphabetic',
						fontSize:element.data().fontSize,
						fontFamily:'"' + element.data().fontFamily + '"',
						fill:'white',						
					};		
				
					const textElement = element.text( 0, 0, 'M' );
					
					textElement.attr( textAttrs );
					textElement.node.setAttributeNS( 'http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve' );

					const charBBox = textElement.getBBox( true );
					const charWidth = charBBox.width;	

					backgroundElement.attr( { x:textWidth / -2, y:charBBox.y, width:textWidth, height:charBBox.height } );
					
					textElement.attr( { text:text } );
					
					const textElementBBox = textElement.getBBox( true );
					const textElementMatrix = new Snap.Matrix();
					
					if( textElementBBox.width > textWidth )
					{
						const textScale = textWidth / textElementBBox.width;
						
						textElementMatrix.scale( textScale, 1, textElementBBox.cx, textElementBBox.cy )
						textElement.transform( textElementMatrix );
					}
					
					const textElement2 = element.text( 0, 0, text );
					
					textElement2.attr( textAttrs );
					textElement2.transform( textElementMatrix );
					textElement2.node.setAttributeNS( 'http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve' );

					element.data().graphics.append( textElement2 );
					element.data().mask.append( textElement );
				}
			}
		}
		
		if( attrs != null && attrs.hasOwnProperty( 'opacity' ) )
		{
			element.data().opacity = attrs.opacity;
			element.attr( { opacity:element.data().opacity } );
		}
		
		setFillAttributes( element, backgroundElement, attrs );
		setLinearGradientAttributes( element, attrs );
	};
	
	const addTextLine = ( text, x = 0, y = 0 ) => 
	{						
		const element = objects.g().attr( { class:'textLine' } );
		const length = text.length;

		element.data().type = 'textLine';
		element.data().text = text;	
		element.data().maxChars = 0;
		element.data().fontSize = 48;
		element.data().fontFamily = '';
		
		element.data().opacity = 1;
		element.data().fillType = 'solid';
		element.data().solidFillColor = '#F00';
		element.data().linearGradient = paper.gradient( 'l(0,0,0,0)' + '#F00' + '-' + '#00F' );
		element.data().radialGradient = paper.gradient( 'r(0.5,0.5,0.5)' + '#F00' + '-' + '#00F' );
		
		setLinearGradientAttributes( element, { fillRotation:-90 } );

		createShadowFilter( element );		
		element.data().graphics = element.g().attr( { visibility:'hidden', filter:element.data().shadowFilter } );	
		
		element.data().mask = element.g();
		
		element.transform( new Snap.Matrix().translate( x, y ) );
		
		const backgroundElement = element.rect( 0, 0, 1, 1 ).attr
		( { 
			fill:element.data().solidFillColor, 
			mask:element.data().mask 
		} );
		
		let textElement = element.text( 0, 0, 'M' );
			textElement.node.setAttributeNS( 'http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve' );
			textElement.attr
			( {
				textAnchor:'middle',
				alignmentBaseline:'middle',
				fontSize:element.data().fontSize,
				fontFamily:'"' + element.data().fontFamily + '"',
				fill:'white',						
			} );

		element.data().textWidth = textElement.getBBox( true ).width * length;
		
		textElement.remove();
		textElement = null;

		setAttributes( element, { text } );

		return element;
	};
	
	const addTextOnCircle = ( text, x = 0, y = 0, radius = 100 ) => 
	{
		const element = objects.g().attr( { class:'textOnCircle' } );
		
		element.data().type = 'textOnCircle';
		element.data().path = '';
		element.data().radius = radius;
		element.data().arcLength = 350;
		element.data().text = text;		
		element.data().maxChars = 0;
		element.data().fontSize = 48;
		element.data().fontFamily = '';
		
		element.data().opacity = 1;
		element.data().fillType = 'solid';
		element.data().solidFillColor = '#F00';
		element.data().linearGradient = paper.gradient( 'l(0,0,0,0)' + '#F00' + '-' + '#00F' );
		element.data().radialGradient = paper.gradient( 'r(0.5,0.5,0.5)' + '#F00' + '-' + '#00F' );
		
		setLinearGradientAttributes( element, { fillRotation:-90 } );

		// shadow
		createShadowFilter( element );		
		element.data().graphics = element.g().attr( { visibility:'hidden', filter:element.data().shadowFilter } );
				
		element.data().mask = element.g();
		
		element.transform( new Snap.Matrix().translate( x, y ) );

		element.circle( 0, 0, radius ).attr
		( { 
			fill:element.data().solidFillColor, 
			mask:element.data().mask 
		} ); 

		element.path( '' ).attr
		( {
			strokeWidth:1,
			fill:'none',
		} );
		
		setAttributes( element, { text } );

		return element;
	};
	
	const getEllipticalArcPath = ( cx, cy, rx, ry, startAngle, arcLength, rotation ) => 
	{
		const applyMatrix = ( [ [ a, b ], [ c, d ] ], [ x, y ] ) => [ a * x + b * y, c * x + d * y ];
		const addVector = ( [ a1, a2 ], [ b1, b2 ] ) => [ a1 + b1, a2 + b2 ];

		arcLength = arcLength % ( 2 * Math.PI );
		
		const m = [ [ Math.cos( rotation ), -Math.sin( rotation ) ], [ Math.sin( rotation ), Math.cos( rotation ) ] ];
		const [ sx, sy ] = addVector( applyMatrix( m, [ rx * Math.cos( startAngle ), ry * Math.sin( startAngle ) ] ), [ cx, cy ] );
		const [ ex, ey ] = addVector( applyMatrix( m, [ rx * Math.cos( startAngle + arcLength ), ry * Math.sin( startAngle + arcLength ) ] ), [ cx, cy ] );
		const fa = ( arcLength > Math.PI ) ? 1 : 0;
		const fs = ( arcLength > 0 ) ? 1 : 0;
		
		return 'M ' + sx + ' ' + sy + ' A ' + [ rx , ry , rotation / ( 2 * Math.PI ) * 360, fa, fs, ex, ey ].join( ' ' );				
	};

	
	const addFont = ( fontObject ) => 
	{
		const element = Snap.parse( '<style data-font="' + fontObject.name +  
						'" type="text/css">@font-face {font-family: "' + fontObject.name + 
						'"; src: url("' + fontObject.dataURL + 
						'");}</style>' ).select( 'style' );
		
		paper.append( element );
		
		element.toDefs();
	};
	
	domContainer.appendChild( paper.node );
	
	paper.node.addEventListener( 'contextmenu', event => event.preventDefault() ); 

	( () => 
	{
		const jsonObject = json == null ? null : JSON.parse( json );
		const fontList = [];
		
		if( jsonObject && Array.isArray( jsonObject.objects ) )
		{
			const fontNames = {};
			
			jsonObject.objects.forEach( attrs => 
			{
				if( fontNames[ attrs.fontFamily ] == null )
				{
					fontNames[ attrs.fontFamily ] = true;
					
					fontList.push
					( {
						name:attrs.fontFamily,
						url:attrs.fontURL,
						type:attrs.fontType,
					} );
				}
			} );
		}
		
		if( fontList.length > 0 )
		{
			let loaded = 0;
			let total = 0;
			
			fontList.forEach( fontObject => 
			{
				total++;
				
				fetch( fontObject.url ).then( response => 
				{
					response.arrayBuffer().then( buffer => 
					{
						const reader = new FileReader();
						
						reader.onload = () => 
						{
							fontObject.dataURL = reader.result;
							
							new FontFace( fontObject.name, 'url("' + fontObject.dataURL + '")' ).load().then( font => 
							{
								fontObject.font = font;
								
								document.fonts.add( font );
								
								addFont( fontObject );

								if( ++loaded == total )
								{
									const backgroundImage = new Image();
									
									backgroundImage.onload = () => 
									{
										width = canvas.width = backgroundImage.naturalWidth;
										height = canvas.height = backgroundImage.naturalHeight;
										
										const backgroundCanvas = document.createElement( 'canvas' );
				
										backgroundCanvas.width = width;
										backgroundCanvas.height = height;
										backgroundCanvas.getContext( '2d' ).drawImage( backgroundImage, 0, 0, width, height );
										
										background.image( backgroundCanvas.toDataURL(), 0, 0, width, height );
										
										jsonObject.objects.forEach( attrs => 
										{
											const type = attrs.type;

											let element;
											
											if( type == 'textOnCircle' )
												element = addTextOnCircle( '' );
											else if( type == 'textLine' )
												element = addTextLine( '' );
											
											if( element != null )
											{
												setAttributes( element, attrs );
												element.transform( attrs.transform );
												elementList.push( element );
												
												if( Array.isArray( attrs.shadows ) )
													attrs.shadows.forEach( shadowAttrs => addShadow( element, shadowAttrs ) );
											}								
										} );
										
										
										paper.attr( { width, height } );
			
										events.loaded.dispatch();
									};
									
									backgroundImage.src = jsonObject.backgroundURL;
								}									
							} );	
						};
						reader.onerror = () => console.error( reader.error );
						reader.readAsDataURL( new Blob( [ buffer ], { type:fontObject.type } ) );
					
					} ).catch( error => console.error( error ) );
					
				} ).catch( error => console.error( error ) );
			} );
		}
	} )(); 

	return {
		events,
		
		toDataURL:( callback ) => 
		{
			context.clearRect( 0, 0, width, height );

			image.src = paper.toDataURL();
			image.onload = () => 
			{
				context.drawImage( image, 0, 0 );
				callback( canvas.toDataURL() );
			};
		},
		width:() => width,
		height:() => height,
		length:() => elementList.length,
		getAttributesAt:( index ) => getAttributes( elementList[ index ] ),
		setTextAt:( index, text ) => setAttributes( elementList[ index ], { text } ),
	};
}; 
