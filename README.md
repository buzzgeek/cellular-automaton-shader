# cellular-automaton-shader
This repository contains a number of short shader scripts that showcase a number of  cellular-automations that use multiple seeds that compete with each other in a given environment. It is possible to implement any cellular automaton via simple shader logic that can run any gpu. Cellular automations can have more than one starting seed, that compete each other in a given envrionment. Also it is possible to assign simple logic rules to each seed to change the seeds behaviour. The typicall known conways game of life only uses one seed with rather simple instruction.

To simply execute the shaders I would like to recomment https://github.com/patriciogonzalezvivo/glslViewer
This is an excellent easy to use shader visualizer.
An excellent resource to learn about shaders can be found under https://thebookofshaders.com/

All shaders contained in the frag folder are different variations of the same automaton with different settings. Please not it is also possible to change the perspective of cells, when it comes to what the cells "see" as neighbours.

This is just an example on how more complex cellular automations can be build using shader logic that can be run on almost any gpu.
