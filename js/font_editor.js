const Editor = ( { domContainer, json, backgroundURL, fontList } ) =>
{
	let width = 1;
	let height = 1;

	const HANDLE_SIZE = 24;
	const HANDLE_ROTATE_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAA9klEQVRIie2TwXHDIBBFn9LAloA7oJSoA6sEuwJKwB2YEtSB3QGTClAHjCrYXMTBtuSAc0v8Zriwy/s7A8CbP09X0WOBA7C725+AE/D1mwAvIodhGOj7/qYwjiMhBOZ5PgHHikEf2BtjNOesW+Sc1RijwL5VbkREY4yb8kKMUUVEAdMScHbO/SgvOOcUOLcEpJRSdUBKSYG0Jtq6ZFXVloHoum7V99FkeYGtgGmapmrJ0rt6YCvgGkKoDlh6r9UHACsiT/9AIedcnqltCQDw1lp99ppSSmqtVcC3ygtORNR7/yD33pfJ3avywidwAfRuXZbam//ON2ozNbNkl43sAAAAAElFTkSuQmCC';
	
	const HANDLE_SCALE_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAKElEQVRIiWNgGAWjYNADRgLy/yk1h4l4t5AHRi0YtWDUglEwCoYEAACykwEUk3EvFwAAAABJRU5ErkJggg==';
	
	const events =
	{
		loaded:new signals.Signal(),
		elementAdded:new signals.Signal(),
		elementRemoved:new signals.Signal(),
		elementSelected:new signals.Signal(),
		elementDeselected:new signals.Signal(),
		elementScaleChanged:new signals.Signal(),
		elementAttributesChanged:new signals.Signal(),
		shadowAdded:new signals.Signal(),
		shadowRemoved:new signals.Signal(),
		shadowAttributesChanged:new signals.Signal(),
		shadowOrderChanged:new signals.Signal(),
		actionStarted:new signals.Signal(),
		actionFinished:new signals.Signal(),
	};
	
	// ----------------------------------------------------------------------
	
	const paper = Snap( width, height );
		  paper.clear();
		  paper.attr( { 'xmlns:xlink':'http://www.w3.org/1999/xlink' } );
							
	const root = paper.g().attr( { id:'root' } );
	const background = root.g();//root.rect( 0, 0, width, height ).attr( { fill:'white' } );
	const editor = root.g().attr( { id:'editor' } );
	const objects = editor.g().attr( { id:'objects' } );
	const hoverBounds = editor.g().attr( { id:'hover-bounds' } );
	const selectedBounds = editor.g().attr( { id:'selected-bounds' } );
	const handles = editor.g().attr( { id:'handles' } );

	let hoverEnabled = true;					
	let hoverElement;				
	let selectedElement;
	
	let isPointerDown = false;
	let pointerX = 0;
	let pointerY = 0;
	let pointerDownX = 0;
	let pointerDownY = 0;

	let action,
		actionMatrix,
		actionElementStartX = 0,
		actionElementStartY = 0,
		actionPaperCenterX = 0,
		actionPaperCenterY = 0,
		actionStartAngle = 0,
		actionStartTextWidth = 0,
		actionStartDistance = 0,
		actionStartRadius = 0,
		actionStartArcLength = 0;

	let rotationHandle, widthHandle, widthHandle2, radiusHandle, arcLengthHandle;

	const updatePaperSize = () =>
	{
		const r = domContainer.getBoundingClientRect();
		const w = r.width; // Math.max( width, r.width ); // r.width
		const h = r.height; // Math.max( height, r.height ); // r.height
		const rx = ( w - width ) / 2;
		const ry = ( h - height ) / 2;
		
		paper.attr( { width:w, height:h } );

		root.transform
		( 
			new Snap.Matrix()
			// .scale( 0.75, 2, rx, ry ) // TEST
			// .rotate( 3, rx, ry ) // TEST
			.translate( rx, ry ) 
		);
	};
	
	const _lut = [];

	for( let i = 0; i < 256; i ++ ) 
		_lut[ i ] = ( i < 16 ? '0' : '' ) + ( i ).toString( 16 );

	const generateUUID = ( prefix ) =>
	{
		const d0 = Math.random() * 0xffffffff | 0;
		const d1 = Math.random() * 0xffffffff | 0;
		const d2 = Math.random() * 0xffffffff | 0;
		const d3 = Math.random() * 0xffffffff | 0;
		const uuid = prefix + '' +
				_lut[ d0 & 0xff ] + _lut[ d0 >> 8 & 0xff ] + _lut[ d0 >> 16 & 0xff ] + _lut[ d0 >> 24 & 0xff ] + '' +
				_lut[ d1 & 0xff ] + _lut[ d1 >> 8 & 0xff ] + '' + _lut[ d1 >> 16 & 0x0f | 0x40 ] + _lut[ d1 >> 24 & 0xff ] + '' +
				_lut[ d2 & 0x3f | 0x80 ] + _lut[ d2 >> 8 & 0xff ] + '' + _lut[ d2 >> 16 & 0xff ] + _lut[ d2 >> 24 & 0xff ] +
				_lut[ d3 & 0xff ] + _lut[ d3 >> 8 & 0xff ] + _lut[ d3 >> 16 & 0xff ] + _lut[ d3 >> 24 & 0xff ];

		return uuid.toUpperCase();
	};
	
	const getElementByUUID = ( uuid ) => 
	{
		return objects.selectAll( 'g[class]' ).items.filter( element => {
			return element.data().uuid == uuid;
		} )[ 0 ];
	};
	
	// ----------------------------------------------------------------------
	
	const updateElementImage = ( element ) => 
	{
		if( element.data().bitmapCache == null ) 
			element.data().bitmapCache = document.createElement( 'canvas' );
			
		const bbox = element.getBBox( true );
		const canvas = element.data().bitmapCache;
		
		canvas.width = bbox.width;
		canvas.height = bbox.height;
		
		// BEGIN_TEMP
		/*if( canvas.parentElement == null ) 
			domContainer.appendChild( canvas );*/
		// END_TEMP 
		
		const context = canvas.getContext( '2d', { alpha:false, willReadFrequently:true } );
		
		context.clearRect( 0, 0, bbox.width, bbox.height );
		context.fillStyle = 'white';
		context.font = element.data().fontSize + 'px ' + '"' + element.data().fontFamily + '"';
			
		const type = element.data().type;
		const graphics = element.data().graphics;
		
		if( type == 'textOnCircle' )
		{
			graphics.selectAll( 'text' ).items.forEach( textElement => 
			{
				const matrix = textElement.transform().localMatrix;
				
				context.textAlign = 'left';
				context.textBaseline = 'alphabetic';
				context.transform( matrix.a, matrix.b, matrix.c, matrix.d, matrix.e - bbox.x, matrix.f - bbox.y );
				context.fillText( textElement.node.textContent, 0, 0 );
				context.resetTransform();
			} );
		}
		else if( type == 'textLine' )
		{
			const textElement = graphics.select( 'text' );
			const matrix = textElement.transform().localMatrix;
			
			context.textAlign = 'center';
			context.textBaseline = 'alphabetic';
			context.transform( matrix.a, matrix.b, matrix.c, matrix.d, matrix.e - bbox.x, matrix.f - bbox.y );						
			context.fillText( textElement.node.textContent, 0, 0 );
			context.resetTransform();
		}
	};
	
	const setFillAttributes = ( element, backgroundElement, attrs ) => 
	{
		if( element && attrs != null && ( attrs.hasOwnProperty( 'fillType' ) || attrs.hasOwnProperty( 'fillColors' ) ) )
		{
			//console.log( 'setFillAttributes' );
			
			let fillType = element.data().fillType;
			
			if( attrs.hasOwnProperty( 'fillType' ) )
			{
				fillType = attrs.fillType;  // TODO: isValidFillType
				
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
	
	const getElementAttributes = ( uuid ) => 
	{
		const attrs = {};
		const element = getElementByUUID( uuid );
		
		if( element )
		{
			attrs.uuid = uuid;
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

					gradientElement.selectAll( 'stop' ).items.forEach( stopElement => 
					{
						attrs.fillColors.push( Snap.getRGB( stopElement.attr( 'stopColor' ) ).hex );
					} );
				}
				
				/* NOTE: move to getElementShadowAttributes
					attrs.shadowEnabled = element.data().shadowEnabled;
					attrs.shadowBlur = element.data().shadowBlur;
					attrs.shadowDistance = element.data().shadowDistance;
					attrs.shadowRotation = element.data().shadowRotation;
					attrs.shadowColor = Snap.getRGB( element.data().shadowColor).hex;
					attrs.shadowOpacity = element.data().shadowOpacity;
				*/
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
		}
	
		return attrs;
	};
	
	const setAttributes = ( element, attrs, forceUpdate = false ) => 
	{
		const type = element.data().type;
			
		//console.log( 'setElementAttributes:', type, attributes );
		
		let backgroundElement = null;
		
		// ----------------------------------------------------------------------
		if( type == 'textOnCircle' )
		{
			const pathElement = element.selectAll( 'path' ).items[ 0 ]; // [class=path]
			
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
				// console.log( 'setTextOnCircleAttributes' );
				
				if( attrs.hasOwnProperty( 'radius' ) )
				{
					radius = Math.max( 30, Math.min( 450, attrs.radius ) );
					
					if( element.data().radius != radius )
					{
						element.data().radius = radius;
						needsUpdate = true;
					}
					else 
					{
						radius = element.data().radius;
					}
				}
				
				if( attrs.hasOwnProperty( 'arcLength' ) )
				{
					arcLength = Math.max( 90, Math.min( 350, attrs.arcLength ) );
					
					if( element.data().arcLength != arcLength )
					{
						element.data().arcLength = arcLength;
						needsUpdate = true;
					}
					else 
					{
						arcLength = element.data().arcLength;
					}
				}
				
				if( attrs.hasOwnProperty( 'text' ) )
				{							
					text = attrs.text;
					
					if( element.data().text != text )
					{
						element.data().text = text;
						needsUpdate = true;
					}
					else 
					{
						text = element.data().text;
					}
				}
				
				if( attrs.hasOwnProperty( 'maxChars' ) )
				{
					maxChars = Math.max( 0, Math.min( 100, attrs.maxChars ) );
					
					if( element.data().maxChars != maxChars )
					{
						element.data().maxChars = maxChars;
						needsUpdate = true;
					}
					else 
					{
						maxChars = element.data().maxChars;
					}
				}
				
				if( attrs.hasOwnProperty( 'fontSize' ) )
				{
					fontSize = Math.max( 12, Math.min( 192, attrs.fontSize ) );
					
					if( element.data().fontSize != fontSize )
					{
						element.data().fontSize = fontSize;
						needsUpdate = true;
					}
					else 
					{
						fontSize = element.data().fontSize;
					}
				}
				
				if( attrs.hasOwnProperty( 'fontFamily' ) )
				{
					fontFamily = attrs.fontFamily;
					
					if( element.data().fontFamily = fontFamily )
					{
						element.data().fontFamily = fontFamily;
						needsUpdate = true;
					}
					else 
					{
						fontFamily = element.data().fontFamily;
					}
				}							 

				if( maxChars > 0 && text.length > maxChars )
				{
					text = text.substr( 0, maxChars );
					needsUpdate = true;
				}
				
				if( forceUpdate || needsUpdate )
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
					pathElement.attr( { d:element.data().path, stroke:( element == selectedElement ) ? 'black' : 'none' } );						
					
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
					
					updateElementImage( element );
				}
			}
			else 
			{
				pathElement.attr( { d:element.data().path, stroke:( element == selectedElement ) ? 'black' : 'none' } );
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
				// console.log( 'setTextLineAttributes' );
				
				if( attrs.hasOwnProperty( 'text' ) )
				{							
					text = attrs.text;
					
					if( element.data().text != text )
					{
						element.data().text = text;
						needsUpdate = true;
					}
					else 
					{
						text = element.data().text;
					}
				}
				
				if( attrs.hasOwnProperty( 'maxChars' ) )
				{
					maxChars = Math.max( 0, Math.min( 100, attrs.maxChars ) );
					
					if( element.data().maxChars != maxChars )
					{
						element.data().maxChars = maxChars;
						needsUpdate = true;
					}
					else 
					{
						maxChars = element.data().maxChars;
					}
				}
				
				if( attrs.hasOwnProperty( 'textWidth' ) )
				{
					textWidth = Math.max( 60, Math.min( 900, attrs.textWidth ) );
					
					if( element.data().textWidth != textWidth )
					{
						element.data().textWidth = textWidth;
						needsUpdate = true;
					}
					else 
					{
						textWidth = element.data().textWidth;
					}
				}
				
				if( attrs.hasOwnProperty( 'fontSize' ) )
				{
					fontSize = Math.max( 12, Math.min( 192, attrs.fontSize ) );
					
					if( element.data().fontSize != fontSize )
					{
						element.data().fontSize = fontSize;
						needsUpdate = true;
					}
					else 
					{
						fontSize = element.data().fontSize;
					}
				}
				
				if( attrs.hasOwnProperty( 'fontFamily' ) )
				{
					fontFamily = attrs.fontFamily;
					
					if( element.data().fontFamily = fontFamily )
					{
						element.data().fontFamily = fontFamily;
						needsUpdate = true;
					}
					else 
					{
						fontFamily = element.data().fontFamily;
					}
				}

				if( maxChars > 0 && text.length > maxChars )
				{
					text = text.substr( 0, maxChars );
					needsUpdate = true;
				}
				
				//

				if( forceUpdate || needsUpdate )
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
					
					updateElementImage( element );
				}
			}
		}
		
		// ----------------------------------------------------------------------
		
		if( attrs != null && attrs.hasOwnProperty( 'opacity' ) )
		{
			element.data().opacity = attrs.opacity;
			element.attr( { opacity:element.data().opacity } );
		}

		setFillAttributes( element, backgroundElement, attrs );
		setLinearGradientAttributes( element, attrs );
				
		// ----------------------------------------------------------------------
		
		if( element == selectedElement )
		{
			drawSelectedBounds( selectedElement );
			updateHandles( selectedElement );
		}
	};

	const setElementAttributes = ( uuid, attrs ) => 
	{	
		const element = getElementByUUID( uuid );
		
		if( element )
		{			
			setAttributes( element, attrs );	
			
			events.elementAttributesChanged.dispatch( uuid );
				
			return true;
		}
		
		return false;
	};
	
	// Begin_ShadowFilter
	
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
	
	const moveShadowToFront = ( element, shadowUUID ) => 
	{
		if( element && element.data().shadowUUIDList.indexOf( shadowUUID ) != -1 )
		{
			
			const index = element.data().shadowUUIDList.indexOf( shadowUUID );
			
			if( index < element.data().shadowUUIDList.length - 1 )
			{
				element.data().shadowUUIDList[ index ] = element.data().shadowUUIDList[ index + 1 ];
				element.data().shadowUUIDList[ index + 1 ] = shadowUUID;
				
				const shadowFilter = element.data().shadowFilter;
				const feMerge = shadowFilter.select( 'feMerge' );
				
				element.data().shadowUUIDList.forEach( uuid => feMerge.append( feMerge.select( 'feMergeNode[in=shadow_' + uuid + ']' ) ) );
				
				return true;
			}
		}
		
		return false;
	};
	
	const moveShadowToBack = ( element, shadowUUID ) => 
	{
		if( element && element.data().shadowUUIDList.indexOf( shadowUUID ) != -1 )
		{
			const index = element.data().shadowUUIDList.indexOf( shadowUUID );
			
			if( index > 0 )
			{
				element.data().shadowUUIDList[ index ] = element.data().shadowUUIDList[ index - 1 ];
				element.data().shadowUUIDList[ index - 1 ] = shadowUUID;
				
				const shadowFilter = element.data().shadowFilter;
				const feMerge = shadowFilter.select( 'feMerge' );
				
				element.data().shadowUUIDList.forEach( uuid => feMerge.append( feMerge.select( 'feMergeNode[in=shadow_' + uuid + ']' ) ) );
				
				return true;
			}
		}
		
		return false;
	};
	
	const removeShadow = ( element, shadowUUID ) => 
	{
		if( element && element.data().shadowUUIDList.indexOf( shadowUUID ) != -1 )
		{
			element.data().shadowAttributes[ shadowUUID ] = null;
			delete element.data().shadowAttributes[ shadowUUID ];
			
			element.data().shadowUUIDList.splice( element.data().shadowUUIDList.indexOf( shadowUUID ), 1 );
			
			const shadowFilter = element.data().shadowFilter;
			
			shadowFilter.select( 'feGaussianBlur[result=blur_' + shadowUUID + ']' ).remove();
			shadowFilter.select( 'feOffset[result=offsetblur_' + shadowUUID + ']' ).remove();
			shadowFilter.select( 'feFlood[result=color_' + shadowUUID + ']' ).remove();
			shadowFilter.select( 'feComposite[result=shadow_' + shadowUUID + ']' ).remove();	
			shadowFilter.select( 'feComponentTransfer[result=shadow_' + shadowUUID + ']' ).remove();
			
			const feMerge = shadowFilter.select( 'feMerge' );
			
			feMerge.select( 'feMergeNode[in=shadow_' + shadowUUID + ']' ).remove();
			
			if( element.data().shadowUUIDList.length == 0 )
				element.data().graphics.attr( { visibility:'hidden' } );
			
			return true;
		}
		
		return false;
	};
	
	const addShadow = ( element, attrs = null ) =>
	{
		if( element )
		{
			const shadowUUID = generateUUID( 'S' );

			element.data().shadowFilter.append( Snap.parse( '<feGaussianBlur in="SourceAlpha" result="blur_' + shadowUUID + '"/>' ) );
			element.data().shadowFilter.append( Snap.parse( '<feOffset in="blur_' + shadowUUID + '" result="offsetblur_' + shadowUUID + '" />' ) );
			element.data().shadowFilter.append( Snap.parse( '<feFlood result="color_' + shadowUUID + '" />' ) );
			element.data().shadowFilter.append( Snap.parse( '<feComposite in="color_' + shadowUUID + '" in2="offsetblur_' + shadowUUID + '" operator="in" result="shadow_' + shadowUUID + '"/>' ) );
			element.data().shadowFilter.append( Snap.parse( '<feComponentTransfer in="shadow_' + shadowUUID + '" result="shadow_' + shadowUUID + '"><feFuncA type="linear" slope="0.5"/></feComponentTransfer>' ) );
		
			const shadowFilter = element.data().shadowFilter;
			const feMerge = shadowFilter.select( 'feMerge' );
			
			feMerge.append( Snap.parse( '<feMergeNode in="shadow_' + shadowUUID + '" />' ) );
			
			shadowFilter.append( feMerge );
			
			element.data().shadowAttributes[ shadowUUID ] = {};	
			element.data().shadowUUIDList.push( shadowUUID );
			
			setShadowAttributes( element, shadowUUID, 
			attrs || { 
				blur:2, 
				distance:8, 
				rotation:45, 
				color:'#000000', 
				opacity:0.5 
			} );
			
			element.data().graphics.attr( { visibility:'visible' } );

			return shadowUUID;
		}
		
		return null;
	};
	
	const getElementShadowUUIDList = ( uuid ) => 
	{
		const element = getElementByUUID( uuid );
		
		if( element )
		{
			return element.data().shadowUUIDList.concat();
		}
		
		return [];
	};
	
	const getElementShadowAttributes = ( uuid, shadowUUID ) =>
	{
		const attrs = {};
		const element = getElementByUUID( uuid );
		
		if( element && element.data().shadowUUIDList.indexOf( shadowUUID ) != -1 )
		{
			attrs.blur = element.data().shadowAttributes[ shadowUUID ].blur;
			attrs.color = element.data().shadowAttributes[ shadowUUID ].color;
			attrs.distance = element.data().shadowAttributes[ shadowUUID ].distance;
			attrs.rotation = element.data().shadowAttributes[ shadowUUID ].rotation;
			attrs.opacity = element.data().shadowAttributes[ shadowUUID ].opacity;
		}
		
		return attrs;
	};
	
	const setElementShadowAttributes = ( uuid, shadowUUID, attrs ) =>
	{
		const element = getElementByUUID( uuid );
		
		if( element && element.data().shadowUUIDList.indexOf( shadowUUID ) != -1 && attrs != null )
		{
			if( setShadowAttributes( element, shadowUUID, attrs ) )
			{
				events.shadowAttributesChanged.dispatch( uuid, shadowUUID );
				return true;
			}
		}
		
		return false;
	};
	
	const moveElementShadowToFront = ( uuid, shadowUUID ) => 
	{
		const element = getElementByUUID( uuid );
		
		if( element && moveShadowToFront( element, shadowUUID ) ) 
		{
			events.shadowOrderChanged.dispatch( uuid );
			return true;
		}
		
		return false;
	};
	
	const moveElementShadowToBack = ( uuid, shadowUUID ) => 
	{
		const element = getElementByUUID( uuid );
		
		if( element && moveShadowToBack( element, shadowUUID ) ) 
		{
			events.shadowOrderChanged.dispatch( uuid );
			return true;
		}
		
		return false;
	};
	
	const addElementShadow = ( uuid ) =>
	{
		const element = getElementByUUID( uuid );
		
		if( element ) 
		{
			const shadowUUID = addShadow( element );
			
			if( shadowUUID != null )
			{
				events.shadowAdded.dispatch( uuid, shadowUUID );
				events.shadowOrderChanged.dispatch( uuid );
				return true;
			}
		}
		
		return false;
	};
	
	const removeElementShadow = ( uuid, shadowUUID ) => 
	{
		const element = getElementByUUID( uuid );
		
		if( element )
		{
			if( removeShadow( element, shadowUUID ) )
			{
				events.shadowRemoved.dispatch( uuid, shadowUUID );
				events.shadowOrderChanged.dispatch( uuid );				
				return true;
			}
		}
		
		return false;
	};

	
	// End_ShadowFilter
	
	const addTextLine = ( text, x = 0, y = 0 ) => 
	{						
		const uuid = generateUUID( 'T' );
		const element = objects.g().attr( { class:'textLine' } );
		const length = text.length;
		
		element.data().uuid = uuid;
		element.data().type = 'textLine';
		element.data().text = text;	
		element.data().maxChars = 0;
		element.data().fontSize = 48;
		element.data().fontFamily = fontList[ 0 ].name;
		
		// fill
		element.data().opacity = 1;
		element.data().fillType = 'solid';
		element.data().solidFillColor = '#F00';
		element.data().linearGradient = paper.gradient( 'l(0,0,0,0)' + '#F00' + '-' + '#00F' );
		element.data().radialGradient = paper.gradient( 'r(0.5,0.5,0.5)' + '#F00' + '-' + '#00F' );
		
		setLinearGradientAttributes( element, { fillRotation:-90 } );
		
		// shadow
		createShadowFilter( element );		
		element.data().graphics = element.g().attr( { visibility:'hidden', filter:element.data().shadowFilter } );
		
		// mask
		element.data().mask = element.g();
		
		element.transform( new Snap.Matrix().translate( x, y ) );
		
		const backgroundElement = element.rect( 0, 0, 1, 1 ).attr( { 
			fill:element.data().solidFillColor, 
			mask:element.data().mask 
		} );
		
		let textElement = element.text( 0, 0, 'M' );
			textElement.attr
			( {
				textAnchor:'middle',
				alignmentBaseline:'middle',
				fontSize:element.data().fontSize,
				fontFamily:'"' + element.data().fontFamily + '"',
				fill:'white',						
			} );
			textElement.node.setAttributeNS( 'http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve' );

		element.data().textWidth = textElement.getBBox( true ).width * length;
		
		textElement.remove();
		textElement = null;
			

		setAttributes( element, { text }, true );

		events.elementAdded.dispatch( uuid );

		return uuid;
	};
	
	const addTextOnCircle = ( text, x = 0, y = 0, radius = 100 ) => 
	{
		const uuid = generateUUID( 'T' );
		const element = objects.g().attr( { class:'textOnCircle' } );
		
		element.data().uuid = uuid;
		element.data().type = 'textOnCircle';
		element.data().path = '';
		element.data().radius = radius;
		element.data().arcLength = 350;
		element.data().text = text;		
		element.data().maxChars = 0;
		element.data().fontSize = 48;
		element.data().fontFamily = fontList[ 0 ].name;
				
		// fill
		element.data().opacity = 1;
		element.data().fillType = 'solid';
		element.data().solidFillColor = '#F00';
		element.data().linearGradient = paper.gradient( 'l(0,0,0,0)' + '#F00' + '-' + '#00F' );
		element.data().radialGradient = paper.gradient( 'r(0.5,0.5,0.5)' + '#F00' + '-' + '#00F' );
		
		setLinearGradientAttributes( element, { fillRotation:-90 } );
		
		// shadow
		createShadowFilter( element );
		
		element.data().graphics = element.g().attr( { visibility:'hidden', filter:element.data().shadowFilter } );
		
		// mask					
		element.data().mask = element.g();
		
		element.transform( new Snap.Matrix().translate( x, y ) );
		
		// background
		element.circle( 0, 0, radius ).attr
		( { 
			fill:element.data().solidFillColor, 
			mask:element.data().mask 
		} );
		
		// path
		element.path( '' ).attr
		( {
			strokeWidth:1,
			fill:'none',
		} );
		
		setAttributes( element, { text }, true );
		
		events.elementAdded.dispatch( uuid );

		return uuid;
	};
	
	// ----------------------------------------------------------------------
	
	

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
	
	const getDistance = ( x1, y1, x2, y2 ) => 
	{
		const a = x1 - x2;
		const b = y1 - y2;

		return Math.sqrt( a * a + b * b );
	};
	
	const globalToLocal = ( element, x, y ) => 
	{
		const matrix = element.transform().globalMatrix.invert();
		
		return { x:matrix.x( x, y ), y:matrix.y( x, y ) };
	};
	
	const localToGlobal = ( element, x, y ) => 
	{
		const matrix = element.transform().globalMatrix;
		
		return { x:matrix.x( x, y ), y:matrix.y( x, y ) };
	};
	
	const hitTestPoint = ( element, x, y ) => 
	{
		const bitmapCache = element.data().bitmapCache;
		const bbox = element.getBBox( true );
		const point = globalToLocal( element, x, y );
		
		point.x -= bbox.x;
		point.y -= bbox.y;

		if( bitmapCache )
			return bitmapCache.getContext( '2d', { alpha:false, willReadFrequently:true } ).getImageData( point.x, point.y, 1, 1 ).data[ 1 ] > 0;
		else 
			return false;
	};
	
	const isPointInside = ( element, x, y ) => 
	{
		const bbox = element.getBBox( true );
		const point = globalToLocal( element, x, y );

		return ( point.x >= bbox.x && point.x <= bbox.x2 && point.y >= bbox.y && point.y <= bbox.y2 );
	};
	
	const getElementAtPoint = ( x, y, hitText = false ) => 
	{
		const items = objects.selectAll( 'g[class]' ).items;
		
		for( let i = items.length - 1; i >= 0; i-- )
		{
			if( !hitText && isPointInside( items[ i ], x, y ) ) 
				return items[ i ];
				
			if( hitText && hitTestPoint( items[ i ], x, y ) ) 
				return items[ i ];
		}
		
		return null;
	};
	
	const getHandleAtPoint = ( x, y ) => 
	{
		const items = handles.selectAll( '*' );

		for( let i = items.length - 1; i >= 0; i-- )
		{	
			if( isPointInside( items[ i ], x, y ) ) 
				return items[ i ];
		}
		
		return null;
	};
	
	const addHandles = ( element ) => 
	{
		rotationHandle = handles.image( HANDLE_ROTATE_URL, 0, 0, HANDLE_SIZE, HANDLE_SIZE );
		rotationHandle.data().action = 'rotate';
		
		if( element.data().type == 'textLine' )
		{
			widthHandle = handles.image( HANDLE_SCALE_URL, 0, 0, HANDLE_SIZE, HANDLE_SIZE );
			widthHandle.data().action = 'changeWidth';

			widthHandle2 = handles.image( HANDLE_SCALE_URL, 0, 0, HANDLE_SIZE, HANDLE_SIZE );
			widthHandle2.data().action = 'changeWidth2';
		}
		
		if( element.data().type == 'textOnCircle' )
		{
			radiusHandle = handles.image( HANDLE_SCALE_URL, 0, 0, HANDLE_SIZE, HANDLE_SIZE );
			radiusHandle.data().action = 'changeRadius';
			
			arcLengthHandle = handles.image( HANDLE_ROTATE_URL, 0, 0, HANDLE_SIZE, HANDLE_SIZE );
			arcLengthHandle.data().action = 'changeArcLength';
		}

		updateHandles( element );
	};
	
	const updateHandles = ( element ) => 
	{
		const handleSize = HANDLE_SIZE;
		const bbox = element.getBBox( true );
		const matrix = element.transform().localMatrix;

		if( rotationHandle )
		{
			rotationHandle.attr
			( {
				x:bbox.x2, 
				y:bbox.y - handleSize,
				width:handleSize,
				height:handleSize,
			} );
			
			rotationHandle.transform( matrix );
		}
		
		if( widthHandle )
		{
			widthHandle.attr
			( {
				x:bbox.x2, 
				y:bbox.cy - handleSize / 2,
				width:handleSize,
				height:handleSize,
			} );
			
			widthHandle.transform( matrix );
		}
		
		if( widthHandle2 )
		{
			widthHandle2.attr
			( {
				x:bbox.x - handleSize, 
				y:bbox.cy - handleSize / 2,
				width:handleSize,
				height:handleSize,
			} );
			
			widthHandle2.transform( matrix );
		}
		
		if( radiusHandle )
		{
			radiusHandle.attr
			( {
				x:bbox.x2, 
				y:bbox.y2,
				width:handleSize,
				height:handleSize,
			} );
			
			radiusHandle.transform( matrix );
		}
		
		if( arcLengthHandle )
		{
			arcLengthHandle.attr
			( {
				x:element.data().pathEndX - handleSize / 2, 
				y:element.data().pathEndY - handleSize / 2,
				width:handleSize,
				height:handleSize,
			} );
			
			arcLengthHandle.transform( matrix );
		}
	};
	
	const removeHandles = () => 
	{
		handles.clear();
		
		rotationHandle = null;
		widthHandle = null;
		widthHandle2 = null;
		radiusHandle = null;
		arcLengthHandle = null;
	};
	
	const clearHoverBounds = () => 
	{
		hoverBounds.clear();
	};
	
	const drawHoverBounds = ( element ) => 
	{
		const bbox = element.getBBox( true );
		const matrix = element.transform().localMatrix;
		
		hoverBounds.clear();
		hoverBounds.rect( bbox.x, bbox.y, bbox.width, bbox.height ).attr
		( {
			stroke:'#000',
			strokeWidth:1,
			strokeDasharray:'10 5',
			fill:'none',
		} ); 
		
		hoverBounds.transform( matrix );
	};
	
	const clearSelectedBounds = () => selectedBounds.clear();
	
	const drawSelectedBounds = ( element ) => 
	{
		const bbox = element.getBBox( true );
		
		selectedBounds.clear();
		selectedBounds.rect( bbox.x, bbox.y, bbox.width, bbox.height );
		selectedBounds.attr( { stroke:'black', strokeWidth:1, fill:'none' } );
		selectedBounds.transform( element.transform().local.toString() );											
	};
	
	const removeSelection = () => 
	{
		const uuid = selectedElement ? selectedElement.data().uuid : null;
		const lastSelectedElement = selectedElement;
		
		selectedElement = null;
		

		if( uuid )
		{						
			clearHoverBounds();
			clearSelectedBounds();									
			removeHandles();
			
			if( lastSelectedElement )
				setAttributes( lastSelectedElement, null );

			events.elementDeselected.dispatch( uuid );
			
			return true;
		}
		
		return false;
	};
	
	const selectElement = ( uuid ) => 
	{
		const element = getElementByUUID( uuid );
		
		if( element )
		{
			removeSelection();
			
			selectedElement = element;
			
			setAttributes( selectedElement, null );

			clearHoverBounds();
			drawSelectedBounds( selectedElement );
			addHandles( selectedElement );

			events.elementSelected.dispatch( uuid );
			
			return true;
		}
		
		return false;
	};

	const removeElement = ( uuid ) => 
	{
		const element = getElementByUUID( uuid );
		
		if( element )
		{
			if( selectedElement == element )
				removeSelection();

			if( element.data().mask )
			{
				if( element.data().mask.parent().type == 'mask' )
					element.data().mask.parent().remove();
				
				element.data().mask.remove();
				element.data().mask = null;
			}
			
			if( element.data().graphics )
			{
				element.data().graphics.attr( { filter:null } );
				element.data().graphics.remove();
				element.data().graphics = null;
			}
			
			if( element.data().linearGradient )
			{
				element.data().linearGradient.remove();
				element.data().linearGradient = null;
			}
			
			if( element.data().radialGradient )
			{
				element.data().radialGradient.remove();
				element.data().radialGradient = null;
			}
			
			if( element.data().shadowFilter )
			{
				element.data().shadowFilter.remove();
				element.data().shadowFilter = null;
			}
			
			element.data().shadowAttributes = null;
			element.data().shadowUUIDList = null;
			
			if( element.data().bitmapCache )
			{
				if( element.data().bitmapCache.parentElement )
					element.data().bitmapCache.remove();
			}
			
			element.data().bitmapCache = null;
			
			// TODO: dispose element.data()
			
			element.remove();

			events.elementRemoved.dispatch( uuid );
			
			return true;
		}
		
		return false;
	};

	const setPointerDown = ( value ) => 
	{	
		const lastAction = action;
		const lastSelectedElement = selectedElement;
		
		isPointerDown = value;
		action = null;

		// mousedown
		if( isPointerDown )
		{
			pointerDownX = pointerX;
			pointerDownY = pointerY;

			if( selectedElement )
			{
				const hoverHandle = getHandleAtPoint( pointerDownX, pointerDownY );

				if( hoverHandle ) 
				{
					action = hoverHandle.data().action;

					if( action != null )
					{
						actionMatrix = selectedElement.transform().localMatrix;
						
						const bbox = selectedElement.getBBox( true );
						const paperCenter = localToGlobal( selectedElement, bbox.cx, bbox.cy ); // FF и Chrome по разному видият BBox - используем cx, cy
						const objectsCenter = globalToLocal( objects, paperCenter.x, paperCenter.y );
						const objectsPointer = globalToLocal( objects, pointerX, pointerY );
						const elementPointer = globalToLocal( selectedElement, pointerX, pointerY );
						
						actionPaperCenterX = paperCenter.x;
						actionPaperCenterY = paperCenter.y;
						
						actionElementStartX = elementPointer.x;
						actionElementStartY = elementPointer.y;

						if( action == 'rotate' )
							actionStartAngle = Math.atan2( objectsPointer.x - objectsCenter.x, objectsPointer.y - objectsCenter.y ) / Math.PI * 180;
						
						if( action == 'changeWidth' || action == 'changeWidth2' )
							actionStartTextWidth = selectedElement.data().textWidth;
							
						if( action == 'changeRadius' )
						{
							actionStartDistance = getDistance( 0, 0, actionElementStartX, actionElementStartY );
							actionStartRadius = selectedElement.data().radius;
						}
						
						if( action == 'changeArcLength' )
						{
							actionStartAngle = Math.atan2( actionElementStartX, actionElementStartY ) / Math.PI * 180;
							actionStartArcLength = selectedElement.data().arcLength;
						}
					}
				}									
			}
			
			const topBBoxElement = getElementAtPoint( pointerX, pointerY, false );
			const topHitTestedElement = getElementAtPoint( pointerX, pointerY, true );
			const topElement = topHitTestedElement || topBBoxElement;
			
			if( action == null && selectedElement )
			{
				if( selectedElement == topElement )
				{
					actionMatrix = selectedElement.transform().localMatrix;
					action = 'drag';
				
					// console.log( 're-drag-start' );
				}
				
				if( topElement == null )
				{
					// deselect
					removeSelection();
				}
			}

			if( action == null && ( selectedElement == null || topElement != selectedElement ) )
			{	
				if( topElement )
				{	
					selectElement( topElement.data().uuid );									
					
					// console.log( 'select' );
					
					actionMatrix = selectedElement.transform().localMatrix;
					action = 'drag';
						
					// objects.add( selectedElement ); DISABLED BringToFront!!!
					// console.log( 'drag-start' );
				}
			}
		}
		
		
		// mouseup
		if( !isPointerDown && selectedElement != null && pointerX == pointerDownX && pointerY == pointerDownY )
		{
			// click
			if( !isPointInside( selectedElement, pointerX, pointerY ) && getHandleAtPoint( pointerX, pointerY ) == null )
			{
				// deselect
				removeSelection();
			}								
		}
		
		if( isPointerDown && action != null ) 
			events.actionStarted.dispatch();
		else 
			events.actionFinished.dispatch();
	};
	
	const setPointer = ( x, y ) => 
	{
		pointerX = x;
		pointerY = y;

		if( hoverEnabled ) 
		{	
			const topBBoxElement = getElementAtPoint( pointerX, pointerY, false );
			const topHitTestedElement = getElementAtPoint( pointerX, pointerY, true );
			const topElement = topHitTestedElement || topBBoxElement;

			if( topElement )
			{
				if( topElement != hoverElement )
				{
					hoverElement = topElement;
					
					if( !selectedElement )
						drawHoverBounds( topElement );									
				}
			}
			else if( hoverElement != null )
			{
				hoverElement = null;
				clearHoverBounds();	
			}
		}
		
		if( action == 'drag' )
		{		
			const startPoint = globalToLocal( objects, pointerDownX, pointerDownY );
			const endPoint = globalToLocal( objects, pointerX, pointerY );
			
			selectedElement.transform( new Snap.Matrix().translate( endPoint.x - startPoint.x, endPoint.y - startPoint.y ).add( actionMatrix ) ); 

			drawSelectedBounds( selectedElement );									
			updateHandles( selectedElement );
			
			// events position ???
		}
		
		if( action == 'rotate' )
		{	
			const objectsCenter = globalToLocal( objects, actionPaperCenterX, actionPaperCenterY );
			const objectsPointer = globalToLocal( objects, pointerX, pointerY );
			const endAngle = Math.atan2( objectsPointer.x - objectsCenter.x, objectsPointer.y - objectsCenter.y ) / Math.PI * 180;
			
			selectedElement.transform( new Snap.Matrix().rotate( actionStartAngle - endAngle, objectsCenter.x, objectsCenter.y ).add( actionMatrix ) ); 
			
			drawSelectedBounds( selectedElement );
			updateHandles( selectedElement );
			
			// events rotation ???
		}
		
		if( action == 'changeArcLength' )
		{
			const elementPointer = globalToLocal( selectedElement, pointerX, pointerY );
			const endAngle = Math.abs( Math.atan2( elementPointer.x, elementPointer.y ) / Math.PI * 180 ); 
			const arcLength = actionStartArcLength - ( endAngle - actionStartAngle ) * 2;
			
			//console.log( actionStartAngle, endAngle );
			
			setAttributes( selectedElement, { arcLength } );
		}
		
		if( action == 'changeWidth' || action == 'changeWidth2' )
		{
			const elementEndX = globalToLocal( selectedElement, pointerX, pointerY ).x;
			const diff = ( action == 'changeWidth' ) ? ( elementEndX - actionElementStartX ) : -( elementEndX - actionElementStartX ); // 
			const textWidth = actionStartTextWidth + diff * 2;
			
			setAttributes( selectedElement, { textWidth } );

			
			// events.elementAttributesChanged.dispatch( selectedElement.data().uuid );
		}
		
		if( action == 'changeRadius' )
		{
			const elementPointer = globalToLocal( selectedElement, pointerX, pointerY );
			const endDistance = getDistance( 0, 0, elementPointer.x, elementPointer.y );
			const radius = actionStartRadius + ( endDistance - actionStartDistance );
			
			setAttributes( selectedElement, { radius } );
			
			// console.log( selectedElement.data().pathStartX, selectedElement.data().pathStartY );
		}
	};
	
	
	
	
	// ----------------------------------------------------------------------
	
	const paperElement = paper.node;
	
	domContainer.appendChild( paperElement );

	paperElement.addEventListener( 'contextmenu', event => event.preventDefault() ); 
	paperElement.addEventListener( 'pointerdown', event => 
	{
		if( !event.isPrimary ) return;
		
		paperElement.setPointerCapture( event.pointerId );
		//paperElement.releasePointerCapture( event.pointerId );
		
		const rect = paperElement.getBoundingClientRect();
		
		setPointer( event.clientX - rect.left, event.clientY - rect.top );	
		setPointerDown( true );
	} );
	
	window.addEventListener( 'pointermove', event => 
	{
		if( !event.isPrimary ) return;
		
		const rect = paperElement.getBoundingClientRect();
		
		setPointer( event.clientX - rect.left, event.clientY - rect.top );						
	} );

	
	window.addEventListener( 'pointerup', event => 
	{
		if( !event.isPrimary ) return;
		
		const rect = paperElement.getBoundingClientRect();
		
		setPointer( event.clientX - rect.left, event.clientY - rect.top );	
		setPointerDown( false );	
	} );

	window.addEventListener( 'resize', event => updatePaperSize() );
	window.addEventListener( 'blur', event => setPointerDown( false ) );


	( () => 
	{
		const data = json == null ? null : JSON.parse( json );
		
		if( data )
			backgroundURL = data.backgroundURL;
			
		const image = new Image();
		
		image.onload = () => 
		{
			width = image.naturalWidth;
			height = image.naturalHeight;
			
			const canvas = document.createElement( 'canvas' );
				
			canvas.width = width;
			canvas.height = height;
			canvas.getContext( '2d' ).drawImage( image, 0, 0, width, height );
			
			background.image( canvas.toDataURL(), 0, 0, width, height );
			
			if( data != null )
			{
				data.objects.forEach( attrs => 
				{
					const type = attrs.type;
					
					delete attrs.type;
					
					let uuid;
					
					if( type == 'textOnCircle' )
						uuid = addTextOnCircle( '' );
					else if( type == 'textLine' )
						uuid = addTextLine( '' );
					
					if( uuid != null )
					{
						const element = getElementByUUID( uuid );

						setAttributes( element, attrs );
						
						element.transform( attrs.transform );
						
						if( Array.isArray( attrs.shadows ) )
						{
							attrs.shadows.forEach( shadowAttrs =>
							{
								addShadow( element, shadowAttrs );
							} );
						}
					}
				} );
			}
			
			updatePaperSize();
				
			events.loaded.dispatch();
		};
		
		image.src = backgroundURL;
		
	} )();

	
	const toJSON = () =>  
	{
		const data = { backgroundURL, objects:[] };	

		objects.selectAll( 'g[class]' ).items.forEach( element => 
		{
			const matrix = element.transform().localMatrix;
			const attrs = getElementAttributes( element.data().uuid );	  
			const fontObject = fontList.filter( fontObject => fontObject.name == attrs.fontFamily )[ 0 ];
			
			console.log( fontObject ); 
			
			attrs.fontURL = fontObject.url;
			attrs.fontType = fontObject.type;
			attrs.transform = matrix.toTransformString();
			attrs.shadows = [];
				  
			element.data().shadowUUIDList.forEach( shadowUUID => 
			{
				attrs.shadows.push
				( {
					blur:element.data().shadowAttributes[ shadowUUID ].blur,
					color:element.data().shadowAttributes[ shadowUUID ].color,
					distance:element.data().shadowAttributes[ shadowUUID ].distance,
					rotation:element.data().shadowAttributes[ shadowUUID ].rotation,
					opacity:element.data().shadowAttributes[ shadowUUID ].opacity,
				} );
			} );
			
			//'matrix(' + matrix.a + ',' + matrix.b + ',' + matrix.c + ',' + matrix.d + ',' + matrix.e + ',' + matrix.f + ')';
				  
			delete attrs.uuid;

			data.objects.push( attrs );
		} );
		
		return JSON.stringify( data );
	};

	return {
		events,
		
		width:() => width,
		height:() => height,
		
		addTextLine,
		addTextOnCircle,
		removeElement,
		getElementAttributes,
		setElementAttributes,
		
		getElementShadowUUIDList,
		addElementShadow,
		removeElementShadow,
		getElementShadowAttributes,
		setElementShadowAttributes,
		moveElementShadowToFront,
		moveElementShadowToBack,		

		toJSON,
	};
};