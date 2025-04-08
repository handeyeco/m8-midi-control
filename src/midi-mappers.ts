import {arraysMatch} from "./util"
import {ControlMode} from "./types"

type MapperOutput = {
  toM8: ReadonlyArray<ReadonlyArray<number>>;
  toLP: ReadonlyArray<ReadonlyArray<number>>;
};

const SYSEX_START = 0xf0;
const SYSEX_END = 0xf7;
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CC = 0xb0;

const C_SOLO_BLUE = 0x4e;

export const DEVICE_ID_REQ = [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7];
const DEVICE_ID_FILLER = [0x01, 0x01, 0x01, 0x01];
export const DEVICE_ID_RES = [
  0xf0,
  0x7e,
  0x00,
  0x06,
  0x02,
  0x00,
  0x20,
  0x29,
  0x13,
  0x01,
  0x00,
  0x00,
  ...DEVICE_ID_FILLER,
  0xf7,
];
export const LPPRO3_PROG_MODE = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x0e, 0x0e, 0x01, 0xf7];
export const LPMINI3_PROG_MODE = [
  0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d, 0x0e, 0x01, 0xf7,
];

export function isSysex(data: ReadonlyArray<number>): boolean {
  if (data.length < 3) return false

  if (data[0] !== SYSEX_START) return false;

  if (data[data.length - 1] !== SYSEX_END) return false;

  return true;
}

// these are the MIDI commands LP uses to communicate
// (besides Sysex)
function isNoteOrCC(statusByte: number): boolean {
  const type = statusByte & 0xf0;
  return type === NOTE_ON || type === NOTE_OFF || type === CC
}

export function mapM8ToLPMidi(data: ReadonlyArray<number>): MapperOutput {
  const toM8: Array<ReadonlyArray<number>> = [];
  const toLP: Array<ReadonlyArray<number>> = [];

  if (isSysex(data)) {
    if (arraysMatch(data, DEVICE_ID_REQ)) {
      // respond to M8 with LP Pro device ID
      toM8.push(DEVICE_ID_RES)
    } else if (arraysMatch(data, LPPRO3_PROG_MODE)) {
      toLP.push(LPMINI3_PROG_MODE)
    }
  }

   else if (isNoteOrCC(data[0])) {
    const [b0, b1, b2] = data

    if (b1 === 0x63) {
      // overwrite control of LP logo LED
      // (note on, channel 1, note 99, color blue)
      toLP.push([0x90, 0x63, C_SOLO_BLUE])
    } else if (
      // LP Mini's arrow up
      b1 === 0x5B ||
      // LP Mini's arrow down
      b1 === 0x5C ||
      // LP Mini's keys buttons
      b1 === 0x61 ||
      // Filter the bottom row,
      // so we can use it for mutes/solos
      (b1 >= 0x0b && b1 <= 0x13)
    ) {
      // ignore overwritten pads
      // (pads that are used in place of LP Pro pads)
    } else if (b1 === 0x50) {
      // move up arrow
      toLP.push([b0, 0x5B, b2])
    } else if (b1 === 0x46) {
      // move down arrow
      toLP.push([b0, 0x5C, b2])
    } else if (b1 === 0x14) {
      // move play button
      toLP.push([b0, 0x61, b2])
    } else if (b1 === 0x02 || b1 === 0x03) {
      // edge case of handling the mute/solo button
      // we only want to pass through the active button
      // (0x05 red for mute, 0x4e blue for solo)
      if ((b1 === 0x02 && b2 === 0x05) || (b1 === 0x03 && b2 === 0x4e)) {
        toLP.push([b0, 0x13, b2])
      }
      // ignore the rest for 0x02 and 0x03
    } else if (b1 >= 0x65 && b1 <= 0x6c) {
      // move mute/solo buttons
      const offset = b1 - 0x65
      toLP.push([b0, 0x0b + offset, b2])
    } else {
      toLP.push(data)
    }
  }

  // if (data.length && !toM8.length && !toLP.length) {
  //   const dataStr = data.map(n => "0x"+n.toString(16)).join(" ")
  //   console.log(`M8 -> LP unhandled/ignored data: ${dataStr}`)
  // }

  return {
    toM8,
    toLP,
  };
}

export function mapLPToM8Midi(data: ReadonlyArray<number>, nextMode: ControlMode = "mute"): MapperOutput {
  const toM8: Array<ReadonlyArray<number>> = [];
  const toLP: Array<ReadonlyArray<number>> = [];

  if (isNoteOrCC(data[0])) {
    const [b0, b1, b2] = data

    if (b1 === 0x5B) {
      // move up arrow
      toM8.push([b0, 0x50, b2])
    } else if (b1 === 0x5C) {
      // move down arrow
      toM8.push([b0, 0x46, b2])
    } else if (b1 === 0x61) {
      // move keys button
      toM8.push([b0, 0x14, b2])
    } else if (b1 >= 0x0b && b1 <= 0x12) {
      // move mute/solo row buttons
      const offset = b1 - 0x0b
      toM8.push([b0, 0x65 + offset, b2])
    } else if (b1 === 0x13) {
      // handle stop/solo/mute button
      // we're using the one Mini button as if it were two Pro buttons
      // depending on the current mute/solo state we're in
      const proMuteButton = 0x02
      const proSoloButton = 0x03
      const toSend = nextMode === "mute" ? proMuteButton : proSoloButton
      toM8.push([b0, toSend, b2])
    } else {
      toM8.push(data)
    }
  }

  // if (data.length && !toM8.length && !toLP.length) {
  //   const dataStr = data.map(n => "0x"+n.toString(16)).join(" ")
  //   console.log(`LP -> M8 unhandled/ignored data: ${dataStr}`)
  // }

  return {
    toM8,
    toLP,
  };
}

export function determineNextControlMode(data: ReadonlyArray<number>, currMode: ControlMode) {
  let nextMode = currMode

  const type = data[0] & 0xF0
  if (type === CC && data[1] === 0x13 && data[2] > 0) {
    nextMode = currMode === "mute" ? "solo" : "mute";
  }

  return nextMode
}