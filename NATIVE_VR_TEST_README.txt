PROJECT FOXPLANET - NATIVE OPENXR V1 TEST

This is a browser-free OpenXR/D3D11 diagnostic build.

It does not use:
- Chrome
- Edge
- Electron
- WebXR

It is intentionally not a full FoxPlanet map build yet. This first test is only to answer the two questions that matter before porting the renderer:

1. Are the black bars at the left/right edges still visible in a native OpenXR submission?
2. Is head movement / stereo rendering noticeably smoother than the current FoxPlanet WebXR mode?

HOW TO RUN

1. Make sure your normal PC VR/OpenXR runtime is active.
2. Run "Launch Native VR Test.bat".
3. Put on the headset.
4. Look around the native OpenXR scene.

WHAT TO REPORT

- Black side bars: YES / NO
- Head movement: smoother / same / worse
- Any doubled-eye image, warped view, or incorrect FOV
- Whether the EXE starts directly in the headset

This build is a diagnostic baseline. If it displays correctly, the next step is porting FoxPlanet's map renderer/data path into this native OpenXR shell instead of trying more Chrome/WebXR workarounds.
