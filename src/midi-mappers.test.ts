import {
  mapM8ToLPMidi,
  mapLPToM8Midi,
  isSysex,
  DEVICE_ID_REQ,
  DEVICE_ID_RES,
  LPPRO3_PROG_MODE,
  LPMINI3_PROG_MODE,
  determineNextControlMode
} from "./midi-mappers";

describe("isSysex", () => {
  it("returns false if there's not enough data for sysex", () => {
    const input = [0xf0, 0xf7];
    const output = isSysex(input);
    expect(output).toBe(false);
  })

  it("returns false for wrong start byte", () => {
    const input = [0x00, 0x00, 0xf7];
    const output = isSysex(input);
    expect(output).toBe(false);
  })

  it("returns false for wrong end byte", () => {
    const input = [0xf0, 0x00, 0x00];
    const output = isSysex(input);
    expect(output).toBe(false);
  })

  it("returns true for valid sysex", () => {
    const input = DEVICE_ID_REQ;
    const output = isSysex(input);
    expect(output).toBe(true);
  })
})

describe("mapM8ToLPMidi", () => {
  it("runs", () => {
    const input = [0x90, 0x51, 0x01];
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [input],
    });
  });

  it("intercepts device ID requests", () => {
    const input = DEVICE_ID_REQ
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [DEVICE_ID_RES],
      toLP: [],
    });
  })

  it("replaces LP Pro programmer mode with LP mini programmer mode", () => {
    const input = LPPRO3_PROG_MODE
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [LPMINI3_PROG_MODE],
    });
  })

  it("overrides the upper-right LP logo", () => {
    const input = [0x90, 0x63, 0x01]
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [[0x90, 0x63, 0x4e]],
    });
  })

  it("moves LP Pro arrows to LP Mini arrows: up", () => {
    const input = [0x90, 0x50, 0x01]
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [[0x90, 0x5B, 0x01]],
    });
  })

  it("ignores LP Mini arrows in favor of LP Pro arrows: up", () => {
    const input = [0x90, 0x5B, 0x01]
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [],
    });
  })

  it("moves LP Pro arrows to LP Mini arrows: down", () => {
    const input = [0x90, 0x46, 0x01]
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [[0x90, 0x5C, 0x01]],
    });
  })

  it("ignores LP Mini arrows in favor of LP Pro arrows: down", () => {
    const input = [0x90, 0x5C, 0x01]
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [],
    });
  })

  it("moves LP Pro play button to LP Mini keys button", () => {
    const input = [0x90, 0x14, 0x01]
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [[0x90, 0x61, 0x01]],
    });
  })

  it("ignores LP Mini keys button in favor of LP Pro play button", () => {
    const input = [0x90, 0x61, 0x01]
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [],
    });
  })

  it("ignores command types it doesn't care about", () => {
    // pitch bend command
    const input = [0xE0, 0x10, 0x00]
    const output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [],
    });
  })

  it("filters commands to bottom row", () => {
    for (let i = 0; i < 9; i++) {
      const input = [0x90, 0x0B + i, 0x01]
      const output = mapM8ToLPMidi(input);
      expect(output).toEqual({
        toM8: [],
        toLP: [],
      });
    }
  })

  it("moves mute/solo row", () => {
    for (let i = 0; i < 8; i++) {
      const input = [0x90, 0x65 + i, 0x01]
      const output = mapM8ToLPMidi(input);
      expect(output).toEqual({
        toM8: [],
        toLP: [[0x90, 0x0b + i, 0x01]],
      });
    }
  })

  it("filters mute/solo buttons when not active", () => {
    for (let i = 0; i < 2; i++) {
      const input = [0x90, 0x02 + i, 0x01]
      const output = mapM8ToLPMidi(input);
      expect(output).toEqual({
        toM8: [],
        toLP: [],
      });
    }
  })

  it("passes through mute/solo buttons when active", () => {
    let input = [0x90, 0x02, 0x05]
    let output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [[0x90, 0x13, 0x05]],
    });

    input = [0x90, 0x03, 0x4e]
    output = mapM8ToLPMidi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [[0x90, 0x13, 0x4e]],
    });
  })
});

describe("mapLPToM8Midi", () => {
  it("runs", () => {
    const input = [0x90, 0x51, 0x01];
    const output = mapLPToM8Midi(input);
    expect(output).toEqual({
      toM8: [input],
      toLP: [],
    });
  });

  it("moves LP Mini arrows to LP Pro arrows: up", () => {
    const input = [0x90, 0x5B, 0x01]
    const output = mapLPToM8Midi(input);
    expect(output).toEqual({
      toM8: [[0x90, 0x50, 0x01]],
      toLP: [],
    });
  })

  it("moves LP Mini arrows to LP Pro arrows: down", () => {
    const input = [0x90, 0x5C, 0x01]
    const output = mapLPToM8Midi(input);
    expect(output).toEqual({
      toM8: [[0x90, 0x46, 0x01]],
      toLP: [],
    });
  })

  it("moves LP Mini keys to LP Pro play", () => {
    const input = [0x90, 0x61, 0x01]
    const output = mapLPToM8Midi(input);
    expect(output).toEqual({
      toM8: [[0x90, 0x14, 0x01]],
      toLP: [],
    });
  })

  it("ignores command types it doesn't care about", () => {
    // pitch bend command
    const input = [0xE0, 0x10, 0x00]
    const output = mapLPToM8Midi(input);
    expect(output).toEqual({
      toM8: [],
      toLP: [],
    });
  })

  it("maps bottom row to mute/solo row", () => {
    for (let i = 0; i < 8; i++) {
      const input = [0x90, 0x0b + i, 0x01]
      const output = mapLPToM8Midi(input);
      expect(output).toEqual({
        toM8: [[0x90, 0x65 + i, 0x01]],
        toLP: [],
      });
    }
  })

  it("remaps solo/mute pad to mute and solo pads", () => {
    let input = [0x90, 0x13, 0x01]
    let output = mapLPToM8Midi(input, "mute");
    expect(output).toEqual({
      toM8: [[0x90, 0x02, 0x01]],
      toLP: [],
    });

    input = [0x90, 0x13, 0x01]
    output = mapLPToM8Midi(input, "solo");
    expect(output).toEqual({
      toM8: [[0x90, 0x03, 0x01]],
      toLP: [],
    });
  })
})

describe("determineNextControlMode", () => {
  it("goes to mute after solo", () => {
    const input = [0xb0, 0x13, 0x01]
    const output = determineNextControlMode(input, "solo")
    expect(output).toBe("mute")
  })

  it("goes to solo after mute", () => {
    const input = [0xb0, 0x13, 0x01]
    const output = determineNextControlMode(input, "mute")
    expect(output).toBe("solo")
  })

  it("ignores 0 CC value", () => {
    const input = [0xb0, 0x13, 0x00]
    const output = determineNextControlMode(input, "mute")
    expect(output).toBe("mute")
  })
})