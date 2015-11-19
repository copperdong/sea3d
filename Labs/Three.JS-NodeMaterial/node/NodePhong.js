/**
 * @author sunag / http://www.sunag.com.br/
 */

THREE.NodePhong = function() {
	
	THREE.NodeGL.call( this, 'phong' );
	
	this.color = new THREE.NodeColor( 0xEEEEEE );
	this.specular = new THREE.NodeColor( 0x111111 );
	this.shininess = new THREE.NodeFloat( 30 );
	
};

THREE.NodePhong.prototype = Object.create( THREE.NodeGL.prototype );
THREE.NodePhong.prototype.constructor = THREE.NodePhong;

THREE.NodePhong.prototype.generate = function( material, shader ) {
	
	var code;
	
	material.define( 'PHONG' );
	material.define( 'ALPHATEST', '0.0' );
	
	material.needsLight = true;
	
	if (shader == 'vertex') {
		
		var transform = this.transform ? this.transform.verifyAndBuildCode( material, shader, 'v3' ) : undefined;
		
		material.mergeUniform( THREE.UniformsUtils.merge( [

			THREE.UniformsLib[ "fog" ],
			THREE.UniformsLib[ "lights" ],
			THREE.UniformsLib[ "shadowmap" ]

		] ) );
		
		material.addVertexPars( [
			"varying vec3 vViewPosition;",

			"#ifndef FLAT_SHADED",

			"	varying vec3 vNormal;",

			"#endif",

			THREE.ShaderChunk[ "common" ],
			THREE.ShaderChunk[ "lights_phong_pars_vertex" ],
			THREE.ShaderChunk[ "morphtarget_pars_vertex" ],
			THREE.ShaderChunk[ "skinning_pars_vertex" ],
			THREE.ShaderChunk[ "shadowmap_pars_vertex" ],
			THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ]

		].join( "\n" ) );
		
		var output = [
				THREE.ShaderChunk[ "beginnormal_vertex" ],
				THREE.ShaderChunk[ "morphnormal_vertex" ],
				THREE.ShaderChunk[ "skinbase_vertex" ],
				THREE.ShaderChunk[ "skinnormal_vertex" ],
				THREE.ShaderChunk[ "defaultnormal_vertex" ],

			"#ifndef FLAT_SHADED", // Normal computed with derivatives when FLAT_SHADED

			"	vNormal = normalize( transformedNormal );",

			"#endif",

				THREE.ShaderChunk[ "begin_vertex" ]
		];
		
		if ( transform ) {
			output.push( transform.code );
			output.push( "transformed = " + transform.result + ";" );
		}
		
		output.push(
				THREE.ShaderChunk[ "morphtarget_vertex" ],
				THREE.ShaderChunk[ "skinning_vertex" ],
				THREE.ShaderChunk[ "project_vertex" ],
				THREE.ShaderChunk[ "logdepthbuf_vertex" ],

			"	vViewPosition = - mvPosition.xyz;",

				THREE.ShaderChunk[ "worldpos_vertex" ],
				THREE.ShaderChunk[ "lights_phong_vertex" ],
				THREE.ShaderChunk[ "shadowmap_vertex" ]
		);
		
		code = output.join( "\n" );
		
	}
	else {
		
		// verify all nodes to reuse generate codes
		
		this.color.verify( material );
		this.specular.verify( material );
		this.shininess.verify( material );
		
		if (this.alpha) this.alpha.verify( material );
		
		if (this.ao) this.ao.verify( material );
		if (this.ambient) this.ambient.verify( material );
		if (this.shadow) this.shadow.verify( material );
		if (this.emissive) this.emissive.verify( material );
		
		if (this.normal) this.normal.verify( material );
		if (this.normal && this.normalScale) this.normalScale.verify( material );
		
		if (this.environment) this.environment.verify( material );
		if (this.environment && this.reflectivity) this.reflectivity.verify( material );
		
		// build code
		
		var color = this.color.buildCode( material, shader, 'v4' );
		var specular = this.specular.buildCode( material, shader, 'c' );
		var shininess = this.shininess.buildCode( material, shader, 'fv1' );
		
		var alpha = this.alpha ? this.alpha.buildCode( material, shader, 'fv1' ) : undefined;
		
		var ao = this.ao ? this.ao.buildCode( material, shader, 'c' ) : undefined;
		var ambient = this.ambient ? this.ambient.buildCode( material, shader, 'c' ) : undefined;
		var shadow = this.shadow ? this.shadow.buildCode( material, shader, 'c' ) : undefined;
		var emissive = this.emissive ? this.emissive.buildCode( material, shader, 'c' ) : undefined;
		
		var normal = this.normal ? this.normal.buildCode( material, shader, 'v3' ) : undefined;
		var normalScale = this.normal && this.normalScale ? this.normalScale.buildCode( material, shader, 'fv1' ) : undefined;
		
		var environment = this.environment ? this.environment.buildCode( material, shader, 'c' ) : undefined;
		var reflectivity = this.environment && this.reflectivity ? this.reflectivity.buildCode( material, shader, 'fv1' ) : undefined;
		
		material.needsTransparent = alpha != undefined;
		
		material.addFragmentPars( [
			THREE.ShaderChunk[ "common" ],
			THREE.ShaderChunk[ "fog_pars_fragment" ],
			THREE.ShaderChunk[ "bsdfs" ],
			THREE.ShaderChunk[ "lights_pars" ],
			THREE.ShaderChunk[ "lights_phong_pars_fragment" ],
			THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
			THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ]
		].join( "\n" ) );
	
		var output = [
				// prevent undeclared normal
				THREE.ShaderChunk[ "normal_fragment" ],
			
				color.code,
			"	vec4 diffuseColor = " + color.result + ";",
			"	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );",
			
				THREE.ShaderChunk[ "logdepthbuf_fragment" ],
				
			specular.code,
			"	vec3 specular = " + specular.result + ";",
			
			shininess.code,
			"	float shininess = max(0.0001," + shininess.result + ");",
			
			"	float specularStrength = 1.0;" // Ignored in NodeMaterial ( replace to specular )
		];	
		
		if (alpha) {
			
			output.push( 
				alpha.code,
				'if ( ' + alpha.result + ' <= ALPHATEST ) discard;'
			);
		
		}
		
		if (normal) {
			
			material.include( shader, 'perturbNormal2Arb' );
			
			output.push(normal.code);
			
			if (normalScale) output.push(normalScale.code);
			
			output.push(
				'normal = perturbNormal2Arb(-vViewPosition,normal,' +
				normal.result + ',' +
				new THREE.NodeUV().build( material, shader, 'v2' ) + ',' +
				(normalScale ? normalScale.result : '1.0') + ');'
			);

		}

		output.push(
			THREE.ShaderChunk[ "shadowmap_fragment" ],
			
			// accumulation
			THREE.ShaderChunk[ "lights_phong_fragment" ],
			THREE.ShaderChunk[ "lights_template" ]
		);
		
		if (ao) { 
			output.push( ao.code );
			output.push( "reflectedLight.indirectDiffuse *= " + ao.result + ";" );
		}
		
		if (ambient) { 
			output.push( ambient.code );
			output.push( "reflectedLight.indirectDiffuse += " + ambient.result + ";" );
		}
		
		if (shadow) {
			output.push( shadow.code );
			output.push( "reflectedLight.directDiffuse *= " + shadow.result + ";" );
			output.push( "reflectedLight.directSpecular *= " + shadow.result + ";" );
		}
		
		if (emissive) { 
			output.push( emissive.code );
			output.push( "reflectedLight.directDiffuse += " + emissive.result + ";" );
		}
		
		output.push("vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular;");
		
		if (environment) {
			output.push( environment.code );
			
			if (reflectivity) {
				
				output.push( reflectivity.code );
				
				output.push( "outgoingLight = mix(" + 'outgoingLight' + "," + environment.result + "," + reflectivity.result + ");" );
				
			}
			else {
			
				output.push( "outgoingLight = " + environment.result + ";" );
			}
		}
		
		output.push(
			THREE.ShaderChunk[ "linear_to_gamma_fragment" ],
			THREE.ShaderChunk[ "fog_fragment" ]
		);
		
		if (alpha) {
			output.push( "gl_FragColor = vec4( outgoingLight, " + alpha.result + " );" );
		}
		else {
			output.push( "gl_FragColor = vec4( outgoingLight, 1.0 );" );
		}
		
		code = output.join( "\n" );
	
	}
	
	return code;

};