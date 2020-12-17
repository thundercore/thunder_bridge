
export const RenameToken = (name) => {
  if (name.includes('TWETH')) {
    return name.replace('TWETH', 'ETH')
  }
  return name
}
