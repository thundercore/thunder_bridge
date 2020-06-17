

async function crashService() {
}

async function checkForeignToHome() {
}

async function checkHomeToForeign() {
}

async function main() {
  const crashTimer = setTimeout(crashService, 10000)
  const foreignTimer = setTimeout(() => {
    checkForeignToHome()
  }, 5000)

  const homeTimer = setTimeout(() => {
    checkHomeToForeign()
  }, 5000)
}

main()