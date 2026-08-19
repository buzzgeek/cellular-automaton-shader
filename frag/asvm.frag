#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D   u_buffer0;
uniform sampler2D   u_buffer1;

uniform vec2        u_resolution;
uniform vec2        u_mouse;
uniform float       u_time;

uniform float u_dt;               // Time delta
uniform float u_trustCatalyst;    // Global Trust parameter

#define ITERATIONS 9

const float MINIMUM = 0.001;
const float gain = 1.0;
const bool isFlat = true;
const bool isSeeded = true;
const float seedProb = 0.5;
const float asvmSeedProb = 0.5;
const bool useASVM = true;

const vec3 birth_rate = vec3(0.1); // the birth rate
const vec3 competition_rate = vec3(0.1); // grow if other population sizes are exceeding the own
const vec3 death_rate = vec3(0.3); // the decay rate of a cell, eg death rate
const vec3 consumption_rate = vec3(0.1); // the amout of food required
const vec3 starvation_rate = vec3(0.1); // indicates when it is time to eat
const vec3 minimum_resource = vec3(0.1); // the minimum required resources to not starve
const vec3 influence_rate = vec3(0.0); // the positive effect the population has on other population types
const vec3 effective_population = vec3(0.2);// the minimum size to be considered a population
const vec3 population_filter = vec3(0.0001); // the great filter (use 0.45 for non-asvm simulation)
const bool allignedSystem = true;


// Hyperparameters
const float D_rho = 0.6;         // Viability diffusion coefficient
const float D_phi = 0.9;         // Entropy diffusion coefficient -- values below 0.8 causes the species to merge and become one static blob
const float gamma_trust = 1.0;   // Viability growth via trust alignment -- has to be 1.0 or all species will die out
const float mu_decay = 0.3;      // Entropic dissipation coefficient -- for values equal to 0.0 or greater then 0.5 all species will die out
const float psi_threshold = 0.1; // Critical boundary integrity threshold
const float trustCatalyst = 0.0; // Global Trust parameter

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
	float r = 0.0;
	float g = 0.0;
	float b = 0.0;
	float a = 0.0;
	
	float prob = useASVM ? asvmSeedProb : seedProb;
	
	if(seed < prob)
	{
		r = clamp(random(seed), 0.1, 0.8);
		g = clamp(random(random(seed)), 0.1, 0.8);
		b = clamp(random(random(random(seed))), 0.1, 0.8);
		a = clamp(random(b), 0.1, 0.8);
		//r = 1.0;
		//g = 0.0;
		//b = 0.0;
	}
	
	return vec4(r,g,b,a);
}

vec3 normalize(vec3 data)
{
	float m = max(data.r, data.g);
	m = max(m, data.b);
	m = max(m, MINIMUM);
	
	return smoothstep(vec3(0),vec3(m),data);
}

vec4 normalize(vec4 data)
{
	float m = max(data.r, data.g);
	m = max(m, data.b);
	m = max(m, data.a);
	m = max(m, MINIMUM);
	
	return smoothstep(vec4(0),vec4(m),data);
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
	vec3 state = normalize(totCol);
		
	float r = state.r;
	float g = state.g;
	float b = state.b;

	vec3 d = vec3(0.0);
	d = normalize(totCol);

	// note the order of events has an effect on the outcome
	// death_rate 
	// cells are slowly dying
	if(death_rate.r >= 0.0)
	{
		(d.r=clamp(d.r - death_rate.r, 0.0, 1.0));
	}
	if(death_rate.g >= 0.0)
	{
		(d.g=clamp(d.g - death_rate.g, 0.0, 1.0));
	}
	if(death_rate.b >= 0.0)
	{
		(d.b=clamp(d.b - death_rate.b, 0.0, 1.0));
	}
	
	//d = normalize(d);
		
	// competition_rate
	// activate super powers if the other cell types are over growing
	if( competition_rate.r != 0.0 && d.r > MINIMUM)
		if(d.r<d.b || d.r<d.g)
			(d.r+=competition_rate.r);
	if( competition_rate.g != 0.0 && d.g > MINIMUM)
		if(d.g<d.b || d.g<d.r)
			(d.g+=competition_rate.g);
	if( competition_rate.b != 0.0 && d.b > MINIMUM)
		if(d.b<d.r || d.b<d.g)
			(d.b+=competition_rate.b);
	
	//d = normalize(d);

	// consumption_rate
	// if there is not enough food the cell will starve
	// otherwise it thrives 
	// TODO: need to implement order of food or dedicated food sources
	if(consumption_rate.r!=0.0)
	{
		if(b > minimum_resource.b || g > minimum_resource.g)
		{
			(d.r+=clamp(consumption_rate.r, 0.0, 1.0));
			(d.g-=clamp(consumption_rate.r*0.5, 0.0, 1.0));
			(d.b-=clamp(consumption_rate.r*0.5, 0.0, 1.0));
		}
		else
			(d.r=clamp(d.r - starvation_rate.r, 0.0, 1.0)); // starve
	}
	if(consumption_rate.g!=0.0)
	{
		if(d.b > minimum_resource.b || d.r > minimum_resource.r)
		{
			(d.g+=clamp(consumption_rate.g, 0.0, 1.0));
			(d.r-=clamp(consumption_rate.g*0.5, 0.0, 1.0));
			(d.b-=clamp(consumption_rate.g*0.5, 0.0, 1.0)); // eat
		}
		else
			(d.g=clamp(d.g - starvation_rate.g, 0.0, 1.0)); // starve
	}
	if(consumption_rate.b!=0.0)
	{
		if(d.g > minimum_resource.g || d.r > minimum_resource.r)
		{
			(d.b+=consumption_rate.b);
			(d.r-=clamp(consumption_rate.b*0.5, 0.0, 1.0)); // eat 
			(d.g-=clamp(consumption_rate.b*0.5, 0.0, 1.0)); // eat
		}
		else
			(d.b=clamp(d.b = starvation_rate.b, 0.0, 1.0)); // starve
	}
	
	//d = normalize(d);
	
	// influence_rate 
	// the cells existence is beneficial for others to survive
	if(influence_rate.r!=0.0 && d.r > effective_population.r)
	{
		(d.g+=influence_rate.r*d.g);
		(d.b+=influence_rate.r*d.b);
	}

	if(influence_rate.g!=0.0 && d.g > effective_population.g)
	{
		(d.r+=influence_rate.g*d.r);
		(d.b+=influence_rate.g*d.b);
	}

	if(influence_rate.b!=0.0 && d.b > effective_population.b)
	{
			(d.r+=influence_rate.b*d.r);
			(d.g+=influence_rate.b*d.g);
	}

	// birth_rate - here come the babies
	if( birth_rate.r != 0.0 && d.r > MINIMUM)
		d.r += birth_rate.r;
	if( birth_rate.g != 0.0 && d.g > MINIMUM)
		d.g += birth_rate.g;
	if( birth_rate.b != 0.0 && d.b > MINIMUM)
		d.b += birth_rate.b;
	//d = normalize(d);

	// apply the great filter
	d -= population_filter;

	// check if the original state was death and set the minimum accordingly
	r = min(d.r, r); 
	g = min(d.g, g);
	b = min(d.b, b);

	// apply the gain and make sure the result is valid	
	r = clamp(r * gain, 0.0, 1.0);
	g = clamp(g * gain, 0.0, 1.0);
	b = clamp(b * gain, 0.0, 1.0);

	if(!isFlat)
	{
		// do some shader magic
		float rn = 0.5;
		float gn = 0.2;
		float bn = 0.7;
		
//		float rn = smoothstep(0.3, r, distance(st, vec2(0.5))); 
//		float gn = smoothstep(0.3, g, distance(st, vec2(0.5))); 
//		float bn = smoothstep(0.3, b, distance(st, vec2(0.5))); 
			
		r = mix(r*gain, rn, distance(st, vec2(0.5)));
		g = mix(g*gain, gn, distance(st, vec2(0.5)));
		b = mix(b*gain, bn, distance(st, vec2(0.5)));
	
	}
	//vec3 resColor = hsb2rgb(vec3(r, g, b));
	//vec3 resColor = vec3(smoothstep(0.0, 0.9, r), smoothstep(0.0, 0.9, g), smoothstep(0.0, 0.9, b));
	vec3 resColor = vec3(r, g, b);

	return resColor;
}

// variable states are not persisted
// so i will use the buffer instead to persist a boolean state
// later i need to make sure that the pixel is not altered via other means
//
// I dunno yet why this worx but it does :)
// I think I am using the implicit info that all pixels are initially vec3(0.0)
// The color change is arbritrary
bool isInitialized(vec2 st)
{
    bool res = false;
    vec2 pixel = 1. / u_resolution;

    vec4 state = texture2D(u_buffer0, pixel);
	
    if(dot(state, state) == 0.0)
    {
        gl_FragColor = vec4(0.42);
	return false;
    }

    return true;
}

// Helper to fetch cell state with periodic boundary conditions
vec4 getCell(int dx, int dy) {
    vec2 st = (gl_FragCoord.xy + vec2(dx, dy)) / u_resolution;
    return texture2D(u_buffer0, fract(st));
}

vec4 project01Fnc(vec2 st)
{
	vec4 neighbors = 
        getCell( -1, -1) + getCell( 0, -1) + getCell( 1, -1) +
        getCell( -1,  0)                   +  getCell( 1,  0) +
        getCell( -1,  1) + getCell( 0,  1) + getCell( 1,  1);

	return vec4(calculate(st, neighbors.rgb), 1.0);
}

vec4 asvm_stateless() {
    vec4 current = getCell(0, 0);
    
    // 1. Fetch 3x3 Moore Neighborhood sums (excluding center)
    vec4 sumNeighbors = vec4(0.0);
    for(int x = -1; x <= 1; x++) {
        for(int y = -1; y <= 1; y++) {
            if(x != 0 || y != 0) {
                sumNeighbors += getCell(x, y);
            }
        }
    }
    vec4 avgNeighbors = sumNeighbors / 8.0;

    // 2. Unclamped Spatial Laplacian (True Diffusion Field)
    vec4 laplacian = avgNeighbors - current;

    // 3. Dynamic Channel Ratios (Implicit Identity)
    // Red   (R) = Structural Viability / Density
    // Green (G) = Entropic Friction / Environmental Pressure
    // Blue  (B) = Relational Trust / Mutual Alignment
    float viability = current.r;
    float entropy   = current.g;
    float trust     = current.b;

    // 4. Emergent Potential Barrier (Psi as an implicit field, not stored state)
    // Barrier potential diverges rapidly if Entropy exceeds Trust * Viability
    float implicitBarrier = smoothstep(0.1, 0.9, trust * viability - entropy);

    // growth
    // 5. Differential Kinetics (State-Less Updates)
    // Viability grows via local trust & diffusion, decaying under entropy
    float dR = D_rho * laplacian.r + (gamma_trust * trust * trustCatalyst) - (mu_decay * entropy);
    
    // decline
    // Entropy increases with viability density, dissipates via local trust 
    float dG = D_phi * laplacian.g + (0.2 * viability) - (0.15 * trust);
    
    // Trust grows when viability is bounded by the implicit barrier, decays under entropy
    float dB = 0.1 * laplacian.b + (gamma_trust * viability * implicitBarrier) - (mu_decay * entropy);

    // 6. Non-Linear Boundary Refusal (The Invariant Barrier Action)
    // If entropy overwhelms the system, the local site collapses (Refusal/Phase Reset)
    vec3 nextState = current.rgb + vec3(dR, dG, dB) * u_dt;
    
    if (implicitBarrier < psi_threshold) {
        // Spatial Refusal: Collapse local entropy, reset to minimal seed
        nextState.g *= 0.1; 
        nextState.r *= 0.5;
    }

    // 7. Global Decay / Filter (Prevents universal equilibrium freeze)
    nextState = clamp(nextState - population_filter, 0.0, 1.0);

    return vec4(nextState, 1.0);
}

// Computes ASVM dynamics for a single pattern channel (c)
// channelDensity: local density of pattern c
// rivalDensity: combined density of competing patterns
// laplacianC: spatial diffusion of pattern c
float computePatternASVM(float channelDensity, float rivalDensity, float laplacianC, bool enableHardBoundary) {
    // 1. Local Viability (rho): Density modulated by diffusion
    float rho = channelDensity;

    // Decline
    // 2. Local Entropic Friction (phi): Competition from rival patterns + crowd overcrowding
    //float phi = rivalDensity * 0.5 + (channelDensity * channelDensity * 0.3);
    float phi = rivalDensity * D_phi + (channelDensity * channelDensity * D_phi);
    //float phi = rivalDensity + (channelDensity * D_phi);

    // Control
    // 3. Emergent Invariant Boundary (psi): Holds as long as Viability exceeds Entropy
    // Uses trustCatalyst as a global environmental stabilizer
    float psi = smoothstep(0.05, 1.0, (rho * trustCatalyst) - phi);
    //float psi = (rho * trustCatalyst) - phi;
    psi = 1.0;

    // Growth
    // 4. Differential Kinetics
    // Growth via viability and spatial spreading, suppressed by entropy
    float dRho = (D_rho * laplacianC) + (gamma_trust * rho * psi);
    dRho -= smoothstep(mu_decay * phi, 0.0, dRho);

    // Hard Boundary	
    // 5. Invariant Boundary Action (Spatial Refusal)
    if (psi < psi_threshold) {
    	if(enableHardBoundary)
    	{
        	// Hard barrier breach: pattern suffers local collapse / refractoriness
		dRho = 0.1 * channelDensity;
	}
	else
    	{
        	// Hard barrier breach: pattern expands / learns to fight back
		dRho = 2.0 * channelDensity;
	}
    }
    
    //return clamp(channelDensity + dRho * u_dt, 0.0, 1.0);
    return clamp(dRho, 0.0, 1.0);
}

vec4 asvm_multi_pattern() {
    vec4 current = getCell(0, 0);
    vec3 nextState = vec3(0.0);
    vec2 pixel = 1. / u_resolution;
    vec2 st = (gl_FragCoord.xy/u_resolution.xy);

    vec4 sumNeighbors = 
    	getCell( -1, -1) + getCell( 0, -1) + getCell( 1, -1) +
	getCell( -1,  0) +                 + getCell( 1,  0) +
	getCell( -1,  1) + getCell( 0,  1) + getCell( 1,  1);
    
    vec4 avgNeighbors = sumNeighbors / 8.0;

    // 2. Unclamped Spatial Laplacians for each pattern
    vec3 laplacian = avgNeighbors.rgb - current.rgb;

    // 3. Evaluate ASVM for each distinct pattern channel independently
    // Pattern R faces friction from G and B
    nextState.r = computePatternASVM(current.r, current.g + current.b, laplacian.r, allignedSystem);

    // Pattern G faces friction from R and B
    nextState.g = computePatternASVM(current.g, current.r + current.b, laplacian.g, true);
	
    // Pattern B faces friction from R and G
    nextState.b = computePatternASVM(current.b, current.r + current.g, laplacian.b, true);

    // 4. Apply Population Filter & Birth Decay
    nextState -= population_filter;

    if(!isFlat)
    {
	// do some shader magic
	vec2 st = (gl_FragCoord.xy/u_resolution.xy);
	float rn = 0.5;
	float gn = 0.2;
	float bn = 0.7;
			
	nextState.r = mix(nextState.r*gain, rn, distance(st, vec2(0.5)));
	nextState.g = mix(nextState.g*gain, gn, distance(st, vec2(0.5)));
	nextState.b = mix(nextState.b*gain, bn, distance(st, vec2(0.5)));
    }


    return vec4(clamp(nextState, 0.0, 1.0), 1.0);
}

void main() {
    vec2 st = (gl_FragCoord.xy/u_resolution.xy);

#ifdef BUFFER_0
    // PING BUFFER
    //
    //  Note: Here is where most of the action happens. But need's to read
    //  te content of the previous pass, for that we are making another buffer
    //  BUFFER_1 (u_buffer1)

	if(isInitialized(st))
	{
	    if(!useASVM)
	    {
		gl_FragColor = project01Fnc(st);
	    }
	    else
	    {
            	gl_FragColor = asvm_multi_pattern();
	    }
	}
	else if(isSeeded)
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
    
    gl_FragColor = vec4(color, 1.0);
#endif
}
