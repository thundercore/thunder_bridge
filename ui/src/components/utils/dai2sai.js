
export const DAI2SAI = (name) => {
  return name.includes('DAI')? name.replace('DAI', 'SAI'): name
}
