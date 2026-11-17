/* A built-in copy of the owner's 6-day push/pull/legs plan, loaded through the normal plan
 * import (parsePlan + planImportSheet), so it can be added from the starter plan list in one tap.
 * Sunday is a rest day, so the week has no "0" key. Each slot's id is an exercise id from the
 * catalogue (lib/exercises.js); a slot's subs are its planned alternatives. */
export const SIX_DAY_PPL = {
  opengym_plan: 1,
  name: '6-Day Push Pull Legs',
  unit: 'kg',
  week: {
    '1': ['pull1'],
    '2': ['push1'],
    '3': ['legs1'],
    '4': ['pull2'],
    '5': ['push2'],
    '6': ['legs2']
  },
  routines: [
  {
    id: 'pull1',
    name: 'Pull Day 1',
    emoji: 'pullup',
    ex: [
      { id: '0841', sets: 4, mode: 'reps', reps: 8, repsMin: 6, weight: 0, restSec: 120, prog: 'double', inc: 2.5, subs: ['2291', '0017'], warmup: 'own', warmupRows: [{ wp: 0, r: 10 }, { wp: 40, r: 8 }, { wp: 60, r: 5 }, { wp: 80, r: 3 }], note: 'Effort 7 to 8. Pull your shoulder blades down and back first, then pull your elbows toward your hips, and lower yourself under control to a full hang at the bottom.' },
      { id: '0118', sets: 4, mode: 'reps', reps: 8, repsMin: 6, weight: 0, restSec: 120, prog: 'double', inc: 2.5, subs: ['0293', '0218'], note: 'Effort 7 to 8. Bend forward to about 45 degrees, pull the bar to your belly button, and squeeze your back hard at the top.' },
      { id: '6032', sets: 3, mode: 'reps', reps: 12, repsMin: 10, weight: 0, restSec: 90, prog: 'double', inc: 2.5, subs: ['6513', '2393'], note: 'Effort 7 to 8. Let your arms fully stretch forward at the start of each repetition, then squeeze your mid-back at the peak of the pull.' },
      { id: '0199', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 60, subs: ['0375', '2285'], note: 'Effort 7 to 8. Keep your arms nearly straight and move them in an arc from overhead down to your hips, feeling a stretch through your back the whole time.' },
      { id: '5656', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 60, subs: ['0602', '1503'], note: 'Effort 7 to 8. Pull the rope toward your forehead and rotate your wrists outward at the end of the movement.' },
      { id: '0313', sets: 3, mode: 'reps', reps: 15, repsMin: 12, weight: 0, restSec: 60, prog: 'double', inc: 2.5, subs: ['0298', '0165'], note: 'Effort 8 to 9. Keep your grip neutral (palms facing each other) throughout, no swinging, fully straighten your arm at the bottom, lower slowly over 3 seconds.' },
      { id: '0315', sets: 3, mode: 'reps', reps: 15, repsMin: 12, weight: 0, restSec: 60, prog: 'double', inc: 2.5, subs: ['0416', '5703'], note: 'Effort 8 to 9. Sit on an incline bench with your arms hanging straight down behind your torso, and curl without swinging your shoulders forward, this targets the long head of the bicep, which the other two curls in this plan do not directly train.' },
      { id: '1412', sets: 3, mode: 'reps', reps: 20, repsMin: 15, weight: 0, restSec: 45, prog: 'double', inc: 2.5, subs: ['0369', '2917'], note: 'Effort 8 to 9. Rest your forearms on a bench with your wrists hanging off the edge, palms facing up, and curl the bar upward using only your wrists.' },
      { id: '0276', sets: 3, mode: 'reps', reps: 10, weight: 0, restSec: 45, bodyweight: true, note: 'Per side. Keep your lower back pressed flat to the floor, extend the opposite arm and leg out fully at the same time, and do not let your ribs flare upward.' },
      { id: '0715', sets: 3, mode: 'time', sec: 20, weight: 0, restSec: 30, prog: 'time', bodyweight: true, note: 'Per side. Lie on your side, prop yourself up on one forearm, and lift your hips so your body forms a straight line from shoulder to feet, keep your hips from sagging.' },
      { id: '0463', sets: 3, mode: 'time', sec: 30, weight: 0, restSec: 30, prog: 'time', bodyweight: true, note: 'Squeeze your glutes and stomach muscles at the same time, do not let your hips sag, breathe steadily throughout.' },
      { id: '3666', sets: 1, mode: 'cardio', min: 15, speed: 5, incline: 13.5, note: 'After weights. Keep heart rate at 115 to 135 bpm, hands off the rails.' }
    ]
  },
  {
    id: 'push1',
    name: 'Push Day 1',
    emoji: 'barbell',
    ex: [
      { id: '0047', sets: 4, mode: 'reps', reps: 6, repsMin: 5, weight: 0, restSec: 150, prog: 'double', inc: 2.5, subs: ['0757', '0314'], warmup: 'own', warmupRows: [{ wb: true, r: 10 }, { wp: 40, r: 8 }, { wp: 60, r: 5 }, { wp: 80, r: 3 }], note: 'Effort 7 to 8. Pull your shoulder blades back into the bench, lower the bar to your upper chest, keep your elbows at roughly 75 degrees from your torso (not fully flared out).' },
      { id: '0289', sets: 4, mode: 'reps', reps: 8, weight: 0, restSec: 120, prog: 'linear', inc: 2.5, subs: ['0025', '0576'], note: 'Effort 7 to 8. Lower the dumbbells for a deep stretch at the bottom, press them up in a slight arc, and squeeze your chest at the top.' },
      { id: '0171', sets: 3, mode: 'reps', reps: 15, repsMin: 12, weight: 0, restSec: 75, prog: 'double', inc: 2.5, subs: ['0319', '1030'], note: 'Effort 7 to 8. Keep a slight bend in your elbows and imagine hugging a large barrel as you bring your hands together and upward.' },
      { id: '0405', sets: 3, mode: 'reps', reps: 10, weight: 0, restSec: 90, subs: ['0766', '0603'], note: 'Effort 7 to 8. Do not lock your elbows out fully at the top, keep tension on the shoulder throughout the entire range of motion.' },
      { id: '0178', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 60, subs: ['0334', '0584'], note: 'Per side. Effort 8 to 9. Lead the movement with your elbow, lean slightly forward, and angle your thumb slightly downward at the top.' },
      { id: '0200', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 60, subs: ['0201', '0591'], note: 'Effort 8 to 9. Keep your elbows pinned to your sides, and flare the rope apart at the bottom of the movement for a full contraction.' },
      { id: '0194', sets: 3, mode: 'reps', reps: 12, weight: 0, restSec: 60, subs: ['4151', '6158'], note: 'Effort 8 to 9. Keep your elbows narrow and pointed forward, and feel a full stretch in the back of your arm at the top of the movement.' },
      { id: '0921', sets: 2, mode: 'reps', reps: 20, repsMin: 15, weight: 0, restSec: 45, note: 'Per arm. Light band. Keep your elbow pinned to your side, rotate your forearm outward slowly, do not let your shoulder shrug upward.' },
      { id: '3666', sets: 1, mode: 'cardio', min: 15, speed: 5, incline: 13.5, note: 'After weights. Keep heart rate at 115 to 135 bpm, hands off the rails.' }
    ]
  },
  {
    id: 'legs1',
    name: 'Leg Day 1',
    emoji: 'legs',
    ex: [
      { id: '3666', sets: 1, mode: 'cardio', min: 10, speed: 4.5, incline: 10, note: 'Warm-up before the ramp-up sets. Hands off the rails.' },
      { id: '0043', sets: 4, mode: 'reps', reps: 5, weight: 0, restSec: 180, prog: 'linear', inc: 2.5, subs: ['3281', '5516'], warmup: 'own', warmupRows: [{ wb: true, r: 10 }, { wp: 40, r: 8 }, { wp: 60, r: 5 }, { wp: 80, r: 3 }], note: 'Effort 7 to 8. Keep your knees tracking over your toes, sit your hips down and back, and drive up through your whole foot.' },
      { id: '2267', sets: 4, mode: 'reps', reps: 10, repsMin: 8, weight: 0, restSec: 120, prog: 'double', inc: 2.5, subs: ['4951', '2290'], note: 'Effort 7 to 8. Do not lock your knees out at the top, lower to a full 90-degree bend, and do not let your hips lift off the pad.' },
      { id: '1557', sets: 3, mode: 'reps', reps: 12, weight: 0, restSec: 90, subs: ['0381', '5825'], note: 'Per leg. Effort 7 to 8. Keep your front shin vertical, and lower your back knee until it nearly touches the floor.' },
      { id: '0585', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 60, subs: ['1489', '5664'], note: 'Effort 8 to 9. Fully straighten your leg at the top, hold for 2 seconds, then lower slowly over 3 seconds.' },
      { id: '1206', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 75, subs: ['0549', '1757'], note: 'Effort 7 to 8. Hinge from your hips with the cable running between your legs, and squeeze your glutes hard at the top of the movement.' },
      { id: '0599', sets: 3, mode: 'reps', reps: 15, repsMin: 12, weight: 0, restSec: 60, prog: 'double', inc: 2.5, subs: ['7746', '1547'], note: 'Effort 8 to 9. Avoid lifting your hips off the pad, curl your heel toward your glutes, and squeeze at the peak of the movement.' },
      { id: '0605', sets: 4, mode: 'reps', reps: 20, repsMin: 15, weight: 0, restSec: 45, prog: 'double', inc: 2.5, subs: ['0594', '1391'], note: 'Effort 8 to 9. Fully stretch at the bottom and hold for 1 second, rise all the way up, do not bounce.' },
      { id: '2755', sets: 2, mode: 'reps', reps: 20, repsMin: 15, weight: 0, restSec: 45, prog: 'double', inc: 2.5, subs: ['6607', '0597'], note: 'Per side. Effort 8 to 9. Attach a cable to your ankle, stand side-on to the machine, and lift your leg out to the side without leaning your torso.' }
    ]
  },
  {
    id: 'pull2',
    name: 'Pull Day 2',
    emoji: 'pullup',
    ex: [
      { id: '1194', sets: 4, mode: 'reps', reps: 8, repsMin: 6, weight: 0, restSec: 150, prog: 'double', inc: 2.5, subs: ['3017', '9698'], warmup: 'own', warmupRows: [{ wp: 20, r: 10 }, { wp: 40, r: 8 }, { wp: 60, r: 5 }], note: 'Effort 7 to 8. Let your arms fully extend forward, then pull the bar all the way back to your lower chest.' },
      { id: '2291', sets: 4, mode: 'reps', reps: 10, repsMin: 8, weight: 0, restSec: 120, prog: 'double', inc: 2.5, subs: ['0245', '7583'], note: 'Effort 7 to 8. Arch your back slightly, pull the bar to your upper chest, and lead the movement with your back muscles rather than your arms.' },
      { id: '2393', sets: 3, mode: 'reps', reps: 12, weight: 0, restSec: 75, subs: ['8299', '4215'], note: 'Per arm. Effort 7 to 8. Drive your elbow straight back with no rotation of your torso, and avoid using a weight that is too heavy to control.' },
      { id: '2487', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 60, subs: ['0602', '0993'], note: 'Effort 8 to 9. Keep your arms roughly parallel to the floor with a slight bend in your elbows, and squeeze your rear shoulders at the peak.' },
      { id: '5656', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 60, subs: ['1503', '0602'], note: 'Effort 7 to 8. Pull the rope toward your forehead and rotate your wrists outward at the end, this is a shoulder health priority movement.' },
      { id: '6406', sets: 3, mode: 'reps', reps: 12, repsMin: 10, weight: 0, restSec: 75, prog: 'double', inc: 2.5, subs: ['9931', '0868'], note: 'Effort 8 to 9. Fully straighten your arm at the bottom, squeeze at the top, and use no swinging momentum, the palms-up grip here targets the short head of the bicep for peak shape.' },
      { id: '0095', sets: 3, mode: 'reps', reps: 15, repsMin: 12, weight: 0, restSec: 60, prog: 'double', inc: 2.5, subs: ['0220', '4103'], note: 'Effort 8 to 9. Move straight up and down with no rolling motion, and pause for 1 second at the top.' },
      { id: '0715', sets: 3, mode: 'time', sec: 20, weight: 0, restSec: 30, prog: 'time', bodyweight: true, note: 'Per side. Same technique as described on Monday, prop up on one forearm, hips lifted in a straight line, no sagging.' },
      { id: '9819', sets: 3, mode: 'reps', reps: 15, repsMin: 12, weight: 0, restSec: 45, bodyweight: true, note: 'No swinging, tilt your pelvis backward at the top of the movement, lower slowly.' },
      { id: '0175', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 45, note: 'Crunch from your rib cage down toward your hips, do not pull with your neck, feel your stomach muscles contract.' },
      { id: '0594', sets: 3, mode: 'reps', reps: 20, weight: 0, restSec: 45, note: 'Effort 8 to 9. Stretch deeply at the bottom for 1 second, rise up fully, hold for 1 second at the top.' },
      { id: '3666', sets: 1, mode: 'cardio', min: 15, speed: 5, incline: 13.5, note: 'After weights. Keep heart rate at 115 to 135 bpm, hands off the rails.' }
    ]
  },
  {
    id: 'push2',
    name: 'Push Day 2',
    emoji: 'barbell',
    ex: [
      { id: '0025', sets: 4, mode: 'reps', reps: 6, repsMin: 5, weight: 0, restSec: 150, prog: 'double', inc: 2.5, subs: ['0289', '0576'], warmup: 'own', warmupRows: [{ wb: true, r: 10 }, { wp: 40, r: 8 }, { wp: 60, r: 5 }, { wp: 80, r: 3 }], note: 'Effort 7 to 8. Arch your back naturally, keep your feet flat on the floor, lower the bar to your nipple line, press up explosively and lower under control.' },
      { id: '8141', sets: 4, mode: 'reps', reps: 12, repsMin: 10, weight: 0, restSec: 90, prog: 'double', inc: 2.5, subs: ['0302', '1030'], note: 'Effort 7 to 8. Lean slightly forward and cross your hands at the bottom of the movement, squeezing your lower chest hard.' },
      { id: '2137', sets: 3, mode: 'reps', reps: 10, weight: 0, restSec: 90, subs: ['0405', '0603'], note: 'Effort 7 to 8. Start with your palms facing you at the bottom, and rotate them to face forward as you press the weight overhead.' },
      { id: '0192', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 60, subs: ['2415', '0584'], note: 'Per side. Effort 8 to 9. Position the cable behind your back, keep your arm slightly forward of your body, and lead the movement with your elbow.' },
      { id: '2487', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 60, subs: ['0602', '1503'], note: 'Effort 8 to 9. Keep your arms roughly parallel to the floor with a slight bend in your elbows, squeeze at the peak.' },
      { id: '0030', sets: 3, mode: 'reps', reps: 12, weight: 0, restSec: 75, subs: ['4130', '0860'], note: 'Effort 8 to 9. Keep your elbows in close to your body, lower slowly to your chest, and drive back up using your triceps.' },
      { id: '0921', sets: 2, mode: 'reps', reps: 20, repsMin: 15, weight: 0, restSec: 45, note: 'Per arm. Light band. Keep your elbow pinned to your side, rotate your forearm outward slowly, do not let your shoulder shrug upward.' },
      { id: '3666', sets: 1, mode: 'cardio', min: 15, speed: 5, incline: 13.5, note: 'After weights. Keep heart rate at 115 to 135 bpm, hands off the rails.' }
    ]
  },
  {
    id: 'legs2',
    name: 'Leg Day 2',
    emoji: 'legs',
    ex: [
      { id: '3666', sets: 1, mode: 'cardio', min: 10, speed: 4.5, incline: 10, note: 'Warm-up before the ramp-up sets. Hands off the rails.' },
      { id: '0032', sets: 4, mode: 'reps', reps: 5, weight: 0, restSec: 180, prog: 'linear', inc: 2.5, subs: ['0811', '0752'], warmup: 'own', warmupRows: [{ wb: true, r: 10 }, { wp: 40, r: 8 }, { wp: 60, r: 5 }, { wp: 80, r: 3 }], note: 'Effort 7 to 8. Brace your core hard, push the floor away from you, keep the bar over the middle of your foot, do not jerk the weight upward.' },
      { id: '0085', sets: 4, mode: 'reps', reps: 10, repsMin: 8, weight: 0, restSec: 120, prog: 'double', inc: 2.5, subs: ['0432', '1206'], note: 'Effort 7 to 8. Push your hips back first, keep your spine neutral, and feel maximum tension in your hamstrings.' },
      { id: '1060', sets: 4, mode: 'reps', reps: 10, repsMin: 8, weight: 0, restSec: 120, prog: 'double', inc: 2.5, subs: ['3110', '4421'], note: 'Effort 7 to 8. Drive your hips upward using your glutes, not your lower back, and tuck your pelvis at the top.' },
      { id: '7746', sets: 3, mode: 'reps', reps: 12, repsMin: 10, weight: 0, restSec: 90, bodyweight: true, subs: ['0599', '0569'], note: 'Effort 7 to 8. Lower yourself slowly over 3 to 4 seconds, then curl back up explosively.' },
      { id: '1063', sets: 3, mode: 'reps', reps: 12, weight: 0, restSec: 90, subs: ['5121', '2267'], note: 'Effort 7 to 8. Angle your toes outward at 45 degrees, push through your heels, and feel your inner thighs and glutes working.' },
      { id: '4421', sets: 3, mode: 'reps', reps: 15, weight: 0, restSec: 60, subs: ['6038', '7281'], note: 'Per side. Effort 8 to 9. Lean slightly forward and squeeze your glute fully at the top of the movement.' },
      { id: '0594', sets: 4, mode: 'reps', reps: 20, weight: 0, restSec: 45, subs: ['1391', '1178'], note: 'Effort 8 to 9. Stretch deeply at the bottom for 1 second, rise up on the ball of your foot, hold for 1 second at the top.' }
    ]
  }
  ]
}
