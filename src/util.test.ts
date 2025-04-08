import {arraysMatch} from "./util"

describe("arraysMatch", () => {
  it("returns false for different lengths", () => {
    const rv = arraysMatch([0], [0, 0])
    expect(rv).toBe(false)
  })

  it("returns false for different values", () => {
    const rv = arraysMatch([0, 0], [0, 1])
    expect(rv).toBe(false)
  })

  it("returns true for match (truthy)", () => {
    const rv = arraysMatch([42, 420], [42, 420])
    expect(rv).toBe(true)
  })

  it("returns true for match (falsy)", () => {
    const rv = arraysMatch([0, 0, 0], [0, 0, 0])
    expect(rv).toBe(true)
  })
})