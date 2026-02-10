#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D   u_buffer0;
uniform sampler2D   u_buffer1;

uniform vec2        u_resolution;
uniform vec2        u_mouse;
uniform float       u_time;

varying vec2        v_texcoord;

#define ITERATIONS 9

float reserved_range =  0.001;
float MINIMUM = 0.000001;
float gain = 1.0;

vec3 birth_rate = vec3(1.1); // the birth rate
vec3 competition_rate = vec3(0.0); // grow if other population sizes are exceeding the own
vec3 death_rate = vec3(0.0); // the decay rate of a cell, eg death rate
vec3 consumption_rate = vec3(0.0); // the amout of food required
vec3 starvation_rate = vec3(0.0); // indicates when it is time to eat
vec3 minimum_resource = vec3(0.0); // the minimum required resources to not starve
vec3 influence_rate = vec3(0.0); // the positive effect the population has on other population types
vec3 effective_population = vec3(1.0);// the minimum size to be considered a population
vec3 population_filter = vec3(0.0); // the great filter
vec3 mutation = vec3(0.0);


//bool init = false; // this does not work!! see func isInit instead
// states of boolean are not stored during runs
// so all declared variables are essentially constant

float random (in float x) {
    return fract(sin(x)*43758.5453123);
}

float random (in vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123);
}

float random (in vec2 st, in float x) {
    return fract(random(st)*random(x));
}

vec4 randomColor(vec2 st)
{
	// u_time is the same for all pipes but different for each iteration
	// st is different for all pipes
	float seed = random(st)*random(u_time);
	float r = random(seed);
	float g = random(random(seed));
	float b = random(random(random(seed)));
	return vec4(vec3(r,g,b), 1.0);
}

vec3 normalize(vec3 data)
{
	float m = max(data.r, data.g);
	m = max(m, data.b);
	m = max(m, MINIMUM);
	
	return vec3(data/m);
}

vec3 hsb2rgb( in vec3 c ){
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
                             6.0)-3.0)-1.0,
                     0.0,
                     1.0 );
    rgb = rgb*rgb*(3.0-2.0*rgb);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

vec3 calculate(vec2 st, vec3 totCol)
{
	totCol = normalize(totCol);

	gain = 0.9;
	birth_rate = vec3(0.1, 0.1, 0.01);
	death_rate = vec3(0.05, 0.05, 0.0);
	consumption_rate = vec3(0.01, 0.1, 0.0);
	starvation_rate = vec3(0.7, 0.8, 0.0);
	minimum_resource = vec3(0.4, 0.6, 0.9);
	competition_rate = vec3(0.0, 0.0, 0.0); // seems very necessary
	influence_rate = vec3(0.0,0.0,0.0); // eg polution would be negative
	effective_population = vec3(0.9, 0.4, 0.9);
	population_filter = vec3(0.1, 0.1, 0.1); // removes brightness/bloom
	mutation = vec3(0.0);

	// note the order of events has an effect on the outcome
	// death_rate 
	// cells are slowly dying
	if(death_rate.r != 0.0)
	{
		(totCol.r=clamp(totCol.r - death_rate.r, 0.0, 1.0));
	}
	if(death_rate.g != 0.0)
	{
		(totCol.g=clamp(totCol.g - death_rate.g, 0.0, 1.0));
	}
	if(death_rate.b != 0.0)
	{
		(totCol.b=clamp(totCol.b - death_rate.b, 0.0, 1.0));
	}
	
	totCol = normalize(totCol);
		
	// competition_rate
	// activate super powers if the other cell types are over growing
	if( competition_rate.r != 0.0 && totCol.r > MINIMUM)
		if(totCol.r<totCol.b || totCol.r<totCol.g)
			(totCol.r+=competition_rate.r);
	if( competition_rate.g != 0.0 && totCol.g > MINIMUM)
		if(totCol.g<totCol.b || totCol.g<totCol.r)
			(totCol.g+=competition_rate.g);
	if( competition_rate.b != 0.0 && totCol.b > MINIMUM)
		if(totCol.b<totCol.r || totCol.b<totCol.g)
			(totCol.b+=competition_rate.b);
	
	totCol = normalize(totCol);

	// consumption_rate
	// if there is not enough food the cell will starve
	// other wise it thrives 
	// TODO: need to implement order of food or dedicated food sources
	if(consumption_rate.r!=0.0)
	{
		if(totCol.b > minimum_resource.b || totCol.g > minimum_resource.g)
		{
			(totCol.r+=clamp(consumption_rate.r, 0.0, 1.0));
			(totCol.g-=clamp(consumption_rate.r*0.5, 0.0, 1.0));
			(totCol.b-=clamp(consumption_rate.r*0.5, 0.0, 1.0));
		}
		else
			(totCol.r=clamp(totCol.r - starvation_rate.r, 0.0, 1.0)); // starve
	}
	if(consumption_rate.g!=0.0)
	{
		if(totCol.b > minimum_resource.b || totCol.r > minimum_resource.r)
		{
			(totCol.g+=clamp(consumption_rate.g, 0.0, 1.0));
			(totCol.r-=clamp(consumption_rate.g*0.5, 0.0, 1.0));
			(totCol.b-=clamp(consumption_rate.g*0.5, 0.0, 1.0)); // eat
		}
		else
			(totCol.g=clamp(totCol.g - starvation_rate.g, 0.0, 1.0)); // starve
	}
	if(consumption_rate.b!=0.0)
	{
		if(totCol.g > minimum_resource.g || totCol.r > minimum_resource.r)
		{
			(totCol.b+=consumption_rate.b);
			(totCol.r-=clamp(consumption_rate.b*0.5, 0.0, 1.0)); // eat 
			(totCol.g-=clamp(consumption_rate.b*0.5, 0.0, 1.0)); // eat
		}
		else
			(totCol.b=clamp(totCol.b = starvation_rate.b, 0.0, 1.0)); // starve
	}
	
	totCol = normalize(totCol);
	
	// influence_rate 
	// the cells existence is beneficial for others to survive
	if(influence_rate.r!=0.0 &&totCol.r>effective_population.r)
	{
		(totCol.g+=influence_rate.r*totCol.g);
		(totCol.b+=influence_rate.r*totCol.b);
	}

	if(influence_rate.g!=0.0 && totCol.g>effective_population.g)
	{
		(totCol.r+=influence_rate.g*totCol.r);
		(totCol.b+=influence_rate.g*totCol.b);
	}

	if(influence_rate.b!=0.0 && totCol.b>effective_population.b)
	{
			(totCol.r+=influence_rate.b*totCol.r);
			(totCol.g+=influence_rate.b*totCol.g);
	}
	totCol = normalize(totCol);
	
	// mutation is rare
//	switch( int(mod(random(u_time), 100.0)) ){
//		case 0:
//			if(mutation.r!=0.0)
//				dr += (mod(random(u_time), RAND_MAX) * mutation.r);
//			break;
//		case 1:
//			if(mutation.g!=0.0)
//				dg += (mod(random(u_time), RAND_MAX) * mutation.g);
//			break;
//		case 2:
//			if(mutation.b!=0.0)
//				db += (mod(random(u_time), RAND_MAX) * mutation.b);
//			break;
//	}
//	d = normalize(d);

	// birth_rate - here come the babies
	if( birth_rate.r != 0.0 && totCol.r > MINIMUM)
		totCol.r += birth_rate.r;
	if( birth_rate.g != 0.0 && totCol.g > MINIMUM)
		totCol.g += birth_rate.g;
	if( birth_rate.b != 0.0 && totCol.b > MINIMUM)
		totCol.b += birth_rate.b;
	totCol = normalize(totCol);

	// apply the great filter
	totCol.r -= population_filter.r;
	totCol.g -= population_filter.g;
	totCol.b -= population_filter.b;

	// check if the original state was death and set the minimum accordingly
//	r = min(totCol.r, r); 
//	g = min(totCol.g, g);
//	b = min(totCol.b, b);

	// apply the gain and make sure the result is valid	
	totCol.r = clamp(totCol.r * gain, 0.0, 1.0);
	totCol.g = clamp(totCol.g * gain, 0.0, 1.0);
	totCol.b = clamp(totCol.b * gain, 0.0, 1.0);

	if(false)
	{
		// do some shader magic
		//rn = smoothstep(rn, totCol.r, distance(st, vec2(0.5))); 
		//gn = smoothstep(gn, totCol.g, distance(st, vec2(0.5))); 
		//bn = smoothstep(bn, totCol.b, distance(st, vec2(0.5))); 
		float rn = 1.0;
		float gn = 1.0;
		float bn = 1.0;
		
		vec2 dtc = vec2(st.x, st.y);
		float a = u_resolution.x/u_resolution.y;
		
		float dst = distance(vec2(dtc.x * a, dtc.y), vec2(0.5 * a, 0.5));
		if( u_resolution.y > u_resolution.x)
			dst = distance(vec2(dtc.x, dtc.y * 1.0/a), vec2(0.5, 0.5 * 1.0/a));
		
		totCol.r = mix(totCol.r, rn, dst);
		totCol.g = mix(totCol.g, gn, dst);
		totCol.b = mix(totCol.b, bn, dst);
		
//		totCol.r = smoothstep(dst, rn, totCol.r);
//		totCol.g = smoothstep(dst, gn, totCol.g);
//		totCol.b = smoothstep(dst, bn, totCol.b);
		
//		totCol.r = smoothstep(0.0, 1.0, dst);
//		totCol.g = smoothstep(0.0, 1.0, dst);
//		totCol.b = smoothstep(0.0, 1.0, dst);
	
	}

	return totCol;
}

// variable states are not persisted
// so i will use the buffer instead to persit a boolean state
// later i need to make sure that the pixel is not altered via other means
//
// I dunno yet why this worx but it does :)
// I think I am using the implicit info that all pixels are initially vec3(0.0)
// The color change is arbritrary
bool isInitialized(vec2 st, vec2 pixel)
{
	bool res = false;

	vec4 state = texture2D(u_buffer1, pixel);
	
// I thought that I need to use reserved_range but I don't
//	if(distance(st, pixel) <= reserved_range)
//		return true;
	
	if(dot(state, state) == 0.0)
	{
		gl_FragColor = vec4(0.42);
		return false;
	}

	return true;
}


vec4 project01Fnc(vec2 st, vec2 pixel)
{
		vec2 offset[9];
		offset[0] = pixel * vec2(-1.0,-1.0);
		offset[1] = pixel * vec2( 0.0,-1.0);
		offset[2] = pixel * vec2( 1.0,-1.0);

		offset[3] = pixel * vec2(-1.0,0.0);
		offset[4] = pixel * vec2( 0.0,0.0);
		offset[5] = pixel * vec2( 1.0,0.0);

		offset[6] = pixel * vec2(-1.0,1.0);
		offset[7] = pixel * vec2( 0.0,1.0);
		offset[8] = pixel * vec2( 1.0,1.0);

		vec3 totCol = vec3(0.0);

		for (int i=0; i < ITERATIONS; i++){
			totCol += texture2D(u_buffer1, st + offset[i]).rgb; 
		}

		return vec4(calculate(st, totCol), 1.0);
}

void main() {
    vec2 pixel = 1. / u_resolution;
	vec2 st = (gl_FragCoord.xy/u_resolution.xy);

#ifdef BUFFER_0
    // PING BUFFER
    //
    //  Note: Here is where most of the action happens. But need's to read
    //  te content of the previous pass, for that we are making another buffer
    //  BUFFER_1 (u_buffer1)

	if(isInitialized(st, pixel))
	{
		if(distance(st, pixel) > reserved_range)
			gl_FragColor = project01Fnc(st, pixel);
			//gl_FragColor = texture2D(u_buffer1, st);
			//gl_FragColor = randomColor(st);
		else
			gl_FragColor = texture2D(u_buffer1, st);
	}
	else
	{
		gl_FragColor = randomColor(st);
	}
		
#elif defined( BUFFER_1 )
    // PONG BUFFER
    //
    //  Note: Just copy the content of the BUFFER0 so it can be 
    //  read by it in the next frame
    //
    gl_FragColor = texture2D(u_buffer0, st);
#else
    // Main Buffer
    vec3 color = vec3(0.0);
    color = texture2D(u_buffer1, st).rgb;
    // color.r = 1.;
    
    gl_FragColor = vec4(color, 1.0);
#endif
}
