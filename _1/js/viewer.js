const Viewer = ( { domContainer, json } ) =>
{
	let width = 1;
	let height = 1;
	
	const elementList = [];
	
	const events =
	{
		loaded:new signals.Signal(),
	};

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
	
	const setShadowAttributes = ( element, attrs ) => 
	{
		if( element && attrs != null && ( attrs.hasOwnProperty( 'shadowBlur' ) || attrs.hasOwnProperty( 'shadowColor' ) ||
			attrs.hasOwnProperty( 'shadowDistance' ) || attrs.hasOwnProperty( 'shadowRotation' ) || attrs.hasOwnProperty( 'shadowOpacity' )	) )
		{
			let shadow = element.data().shadow;
			let blur = element.data().shadowBlur;
			let color = element.data().shadowColor;
			let distance = element.data().shadowDistance;
			let rotation = element.data().shadowRotation;
			let opacity = element.data().shadowOpacity;
			
			if( attrs.hasOwnProperty( 'shadowBlur' ) )
			{
				blur = parseInt( attrs.shadowBlur );
				element.data().shadowBlur = blur;
			}

			if( attrs.hasOwnProperty( 'shadowColor' ) )
			{
				color = Snap.getRGB( attrs.shadowColor ).hex;
				element.data().shadowColor = color;
			}
			
			if( attrs.hasOwnProperty( 'shadowDistance' ) )
			{
				distance = parseFloat( attrs.shadowDistance );
				element.data().shadowDistance = distance;
			}
			
			if( attrs.hasOwnProperty( 'shadowRotation' ) )
			{
				rotation = parseInt( attrs.shadowRotation );
				element.data().shadowRotation = rotation;
			}
			
			if( attrs.hasOwnProperty( 'shadowOpacity' ) )
			{
				opacity = parseFloat( attrs.shadowOpacity );
				element.data().shadowOpacity = opacity;
			}
				
			const dx = Math.sin( rotation / 180 * Math.PI ) * distance;
			const dy = Math.cos( rotation / 180 * Math.PI ) * distance;
		
			shadow.select( 'feGaussianBlur' ).attr( { stdDeviation:blur } );
			shadow.select( 'feFlood' ).attr( { floodColor:color } );
			shadow.select( 'feOffset' ).attr( { dx, dy } );	
			shadow.select( 'feFuncA' ).attr( { slope:opacity } );
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
			
			attrs.shadowEnabled = element.data().shadowEnabled;
			attrs.shadowBlur = element.data().shadowBlur;
			attrs.shadowDistance = element.data().shadowDistance;
			attrs.shadowRotation = element.data().shadowRotation;
			attrs.shadowColor = Snap.getRGB( element.data().shadowColor).hex;
			attrs.shadowOpacity = element.data().shadowOpacity;
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
					let textLength = textElement.node.getComputedTextLength();
					
					textElement.attr( { text:text.replace( /\s/g, '' ) } );

					const textLengthWithoutSpaces = textElement.node.getComputedTextLength();
					const spacesNum = ( text.match( /\s/g ) || [] ).length;
					const spaceWidth = ( textLength - textLengthWithoutSpaces ) / spacesNum;

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

		if( attrs != null && attrs.hasOwnProperty( 'shadowEnabled' ) )
		{
			element.data().shadowEnabled = attrs.shadowEnabled;
			
			if( element.data().shadowEnabled )
				element.data().graphics.attr( { visibility:'visible' } );
			else 
				element.data().graphics.attr( { visibility:'hidden' } );
		}
		
		setFillAttributes( element, backgroundElement, attrs );
		setLinearGradientAttributes( element, attrs );
		setShadowAttributes( element, attrs );
	};
	
	const addTextLine = ( text, x = 0, y = 0 ) => 
	{						
		const element = objects.g().attr( { class:'textLine' } );
		const length = text.length;

		element.data().type = 'textLine';
		element.data().text = text;	
		element.data().maxChars = 0;
		element.data().fontSize = 48;
		element.data().fontFamily = 'Times New Roman';

		element.data().fillType = 'solid';
		element.data().solidFillColor = '#F00';
		element.data().linearGradient = paper.gradient( 'l(0,0,0,0)' + '#F00' + '-' + '#00F' );
		element.data().radialGradient = paper.gradient( 'r(0.5,0.5,0.5)' + '#F00' + '-' + '#00F' );
		
		setLinearGradientAttributes( element, { fillRotation:-90 } );

		element.data().shadowEnabled = false;
		element.data().shadow = paper.filter( Snap.filter.shadow( 0, 0, 0, 'black', 1.0 ) )
			.attr( { x:'-100%', y:'-100%', width:'300%', height:'300%', filterUnits:'objectBoundingBox' } );
		element.data().shadow.selectAll( 'feMergeNode' )[ 1 ].remove();

		setShadowAttributes( element, { shadowBlur:2, shadowDistance:8, shadowRotation:45, shadowColor:'#000000', shadowOpacity:0.5 } );
		
		element.data().graphics = element.g().attr( { visibility:'hidden', filter:element.data().shadow } );	
		
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
		element.data().fontFamily = 'Times New Roman';

		element.data().fillType = 'solid';
		element.data().solidFillColor = '#F00';
		element.data().linearGradient = paper.gradient( 'l(0,0,0,0)' + '#F00' + '-' + '#00F' );
		element.data().radialGradient = paper.gradient( 'r(0.5,0.5,0.5)' + '#F00' + '-' + '#00F' );
		
		setLinearGradientAttributes( element, { fillRotation:-90 } );

		element.data().shadowEnabled = false;
		element.data().shadow = paper.filter( Snap.filter.shadow( 0, 0, 0, 'black', 1.0 ) )
			.attr( { x:'-100%', y:'-100%', width:'300%', height:'300%', filterUnits:'objectBoundingBox' } );
		element.data().shadow.selectAll( 'feMergeNode' )[ 1 ].remove(); // <feMergeNode in="SourceGraphic" />

		setShadowAttributes( element, { shadowBlur:2, shadowDistance:8, shadowRotation:45, shadowColor:'#000000', shadowOpacity:0.5 } );

		element.data().graphics = element.g().attr( { visibility:'hidden', filter:element.data().shadow } ); // .attr( { filter:element.data().shadow } );
				
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

	domContainer.appendChild( paper.node );
	
	paper.node.addEventListener( 'contextmenu', event => event.preventDefault() ); 

	( () => 
	{
		const data = json == null ? null : JSON.parse( json );
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
			
			if( data && Array.isArray( data.objects ) )
			{
				data.objects.forEach( attrs => 
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
					}								
				} );
			}
			
			paper.attr( { width, height } );
				
			events.loaded.dispatch();
		};
		
		image.src = data.backgroundURL;
		
	} )();

	return {
		events,
		
		width:() => width,
		height:() => height,
		length:() => elementList.length,
		getAttributesAt:( index ) => getAttributes( elementList[ index ] ),
		setTextAt:( index, text ) => setAttributes( elementList[ index ], { text } ),
	};
}; 
