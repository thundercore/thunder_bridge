
export const RenameToken = (name) => {
  if (name.includes('DAI')) {
    return name.replace('DAI', 'SAI')
  }
  if (name.includes('TWETH')) {
    return name.replace('TWETH', 'ETH')
  }
  return name
}
