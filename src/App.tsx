import { useState, useEffect, useReducer, useRef, useCallback } from "react";
import {mapM8ToLPMidi, mapLPToM8Midi} from "./midi-mappers"
import "./App.css";

// const keys = {
//   PLAY: 0,
//   SHIFT: 1,
//   EDIT: 2,
//   OPTION: 3,
//   LEFT: 4,
//   RIGHT: 5,
//   UP: 6,
//   DOWN: 7,
//   T1_MUTE: 12,
//   T2_MUTE: 13,
//   T3_MUTE: 14,
//   T4_MUTE: 15,
//   T5_MUTE: 16,
//   T6_MUTE: 17,
//   T7_MUTE: 18,
//   T8_MUTE: 19,
//   T1_SOLO: 20,
//   T2_SOLO: 21,
//   T3_SOLO: 22,
//   T4_SOLO: 23,
//   T5_SOLO: 24,
//   T6_SOLO: 25,
//   T7_SOLO: 26,
//   T8_SOLO: 27,
// };

/**
 * TODO
 * - Mute/Solo buttons? (note 2 & 3 + 101-108)
 * - Temp vs toggle mute/solo?
 * - returning to normal layout when disabling CTRL mode
 */

type Action =
  | { type: "init" }
  | { type: "toggle-mute"; track: number }
  | { type: "toggle-solo"; track: number };

type State = {
  mutes: boolean[];
  solos: boolean[];
};

// Colors
// const C_MUTE_RED = 0x05;
const C_SOLO_BLUE = 0x4e;

// MIDI
const CHANNEL = 0x09; // Channel 10
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

const initialState: State = {
  mutes: new Array(8).fill(false),
  solos: new Array(8).fill(false),
};

function reducer(state: State, action: Action) {
  const stateCopy = JSON.parse(JSON.stringify(state));
  switch (action.type) {
    case "toggle-mute": {
      // mutes don't work when something's solo-d
      if (stateCopy.solos.includes(true)) {
        return stateCopy;
      }

      stateCopy.mutes[action.track] = !stateCopy.mutes[action.track];
      stateCopy.solos[action.track] = false;
      return stateCopy;
    }
    case "toggle-solo": {
      stateCopy.solos[action.track] = !stateCopy.solos[action.track];
      stateCopy.mutes[action.track] = false;

      // when going into solo, mutes are lost
      if (stateCopy.solos[action.track]) {
        stateCopy.mutes = new Array(8).fill(false);
      }

      return stateCopy;
    }
    default: {
      return state;
    }
  }
}

function App() {
  const [midiEnabled, setMidiEnabled] = useState<boolean>(false);
  const [noteNum, setNoteNum] = useState<number>(0);
  const [state, dispatch] = useReducer(reducer, initialState);
  const prevState = useRef<State>(state);
  const midiAccess = useRef<MIDIAccess>(null);
  const interfaceInput = useRef<MIDIInput>(null);
  const interfaceOutput = useRef<MIDIOutput>(null);
  const launchpadInput = useRef<MIDIInput>(null);
  const launchpadOutput = useRef<MIDIOutput>(null);

  function sendNoteOn(
    note: number,
    velocity: number = 1,
    channel: number = CHANNEL
  ) {
    if (interfaceOutput?.current) {
      interfaceOutput.current.send([NOTE_ON + channel, note, velocity]);
    }
  }

  function sendNoteOff(
    note: number,
    velocity: number = 0,
    channel: number = CHANNEL
  ) {
    if (interfaceOutput?.current) {
      interfaceOutput.current.send([NOTE_OFF + channel, note, velocity]);
    }
  }

  const handleM8Message = useCallback((event: MIDIMessageEvent) => {
    if (!event.data) return;

    const data = Array.from(event.data);
    const { toM8, toLP } = mapM8ToLPMidi(data)

    toM8.forEach(d => {
      interfaceOutput.current?.send(d);
    })

    toLP.forEach(d => {
      launchpadOutput.current?.send(d);
    })
  }, []);

  const handleLPMessage = useCallback((event: MIDIMessageEvent) => {
    if (!event.data) return;

    const data = Array.from(event.data);
    const { toM8, toLP } = mapLPToM8Midi(data)

    toM8.forEach(d => {
      interfaceOutput.current?.send(d);
    })

    toLP.forEach(d => {
      launchpadOutput.current?.send(d);
    })
  }, []);

  useEffect(() => {
    if (!midiEnabled) {
      navigator.requestMIDIAccess({ sysex: true }).then((access) => {
        midiAccess.current = access;
        setMidiEnabled(true);
      });
    }
  }, [midiEnabled]);

  useEffect(() => {
    if (midiEnabled && midiAccess.current) {
      const access = midiAccess.current;

      Array.from(access.inputs.values()).forEach((i) => {
        if (i.name === "M4") {
          interfaceInput.current = i;
          interfaceInput.current.onmidimessage = handleM8Message;
        }

        if (i.name === "Launchpad Mini MK3 LPMiniMK3 MIDI Out") {
          launchpadInput.current = i;
          launchpadInput.current.onmidimessage = handleLPMessage;
        }
      });

      Array.from(access.outputs.values()).forEach((i) => {
        if (i.name === "M4") {
          interfaceOutput.current = i;
        }

        if (i.name === "Launchpad Mini MK3 LPMiniMK3 MIDI In") {
          launchpadOutput.current = i;
        }
      });

      // cleanup from useEffect
      return () => {
        if (interfaceInput.current) {
          interfaceInput.current.removeEventListener(
            "midimessage",
            handleM8Message
          );
        }

        if (launchpadInput.current) {
          launchpadInput.current.removeEventListener(
            "midimessage",
            handleLPMessage
          );
        }
      };
    }
  }, [midiEnabled, handleM8Message, handleLPMessage]);

  useEffect(() => {
    if (midiEnabled) {
      // light top-right of LP
      launchpadOutput.current?.send([0x90, 0x63, C_SOLO_BLUE]);
    }
  }, [midiEnabled]);

  useEffect(() => {
    if (midiEnabled) {
      for (let i = 0; i < 8; i++) {
        if (state.solos[i] && !prevState.current.solos[i]) {
          sendNoteOn(i + 20);
        } else if (state.mutes[i] && !prevState.current.mutes[i]) {
          sendNoteOn(i + 12);
        } else if (!state.solos[i] && prevState.current.solos[i]) {
          sendNoteOff(i + 20);
        } else if (!state.mutes[i] && prevState.current.mutes[i]) {
          sendNoteOff(i + 12);
        }
      }
    }

    prevState.current = state;
  }, [state, midiEnabled]);

  if (!midiEnabled) return "MIDI Not Enabled";

  function onClickMute(track: number) {
    dispatch({ type: "toggle-mute", track });
  }

  function onClickSolo(track: number) {
    dispatch({ type: "toggle-solo", track });
  }

  function sendNote(num: number, on: boolean) {
    if (on) {
      sendNoteOn(num);
    } else {
      sendNoteOff(num);
    }
  }

  return (
    <>
      <section>
        {!interfaceInput.current
          ? "No M4"
          : `M4 found: ${interfaceInput.current.manufacturer} ${interfaceInput.current.name}`}
      </section>

      <section>
        {!launchpadInput.current
          ? "No Launchpad"
          : `LP found: ${launchpadInput.current.manufacturer} ${launchpadInput.current.name}`}
      </section>

      <section>
        {Array.from(Array(8).keys()).map((i) => {
          return (
            <div>
              <button
                onClick={() => onClickMute(i)}
                className={"mute " + (state.mutes[i] ? "mute--active" : "")}
              >
                Mute {i + 1}
              </button>
              <button
                onClick={() => onClickSolo(i)}
                className={"solo " + (state.solos[i] ? "solo--active" : "")}
              >
                Solo {i + 1}
              </button>
            </div>
          );
        })}
      </section>

      <section>
        <label>
          Note Number
          <input
            type="number"
            min="0"
            max="127"
            step="1"
            value={noteNum}
            onChange={(e) => setNoteNum(+e.target.value)}
          />
        </label>
        <button onClick={() => sendNote(noteNum, true)}>Note On</button>
        <button onClick={() => sendNote(noteNum, false)}>Note Off</button>
        <button
          onClick={() => {
            sendNote(noteNum, true);
            setTimeout(() => sendNote(noteNum, false), 10);
          }}
        >
          On / Off
        </button>
      </section>
    </>
  );
}

export default App;
