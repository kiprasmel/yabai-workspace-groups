#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const cp = require("child_process")

// const TARGET = $1

// const DELTA = ./compare // or call json-diff as module in js?

function reconcile({ targetFile }) {
	const { target, current } = parseWorkspacesData({ targetFile })

	const targetDisplays = target.displays
	const currentDisplays = current.displays

	const targetDisplaysSpaces = targetDisplays.map(x => x.spaces)
	const currentDisplaysSpaces = currentDisplays.map(x => x.spaces)

	console.log({ targetDisplays, currentDisplays, targetDisplaysSpaces, currentDisplaysSpaces })

	handleSpacesToDisplays(currentDisplays, targetDisplays)
	handleWindowsToSpaces(current.spaces, target.spaces, current.windows, target.windows)
}

function handleSpacesToDisplays(currentDisplays, targetDisplays) {
	const currentSpaceToDisplayMap = new Map()
	for (const display of currentDisplays) {
		for (const spaceIndex of display.spaces) {
			if (currentSpaceToDisplayMap.has(spaceIndex)) {
				const existingDisplay = currentSpaceToDisplayMap.get(spaceIndex)
				const msg = `space idx ${spaceIndex} already exists in display ${existingDisplay}`
				throw new Termination(msg)
			}

			/**
			 * TODO FIXME: shouldn't we have the `space.uuid` here, instead of `space.index`?
			 * is this why the spaces/windows are going to incorrect places?
			 */ 
			currentSpaceToDisplayMap.set(spaceIndex, display.uuid)
		}
	}

	const spacesToMoveToDesktop = []
	for (let i = 0; i < targetDisplays.length; i++) {
		const targetDisplay = targetDisplays[i]

		for (const spaceIndex of targetDisplay.spaces) {
			const currDisplayUUID = currentSpaceToDisplayMap.get(spaceIndex)
			const needsToBeMoved = currDisplayUUID !== targetDisplay.uuid

			if (needsToBeMoved) {
				spacesToMoveToDesktop.push([spaceIndex, targetDisplay.uuid])
			}
		}
	}

	console.log({ spacesToMoveToDesktop })

	for (const [spaceIndex, displayUUID] of spacesToMoveToDesktop) {
		const display = currentDisplays.find(x => x.uuid === displayUUID)

		if (!display) {
			const msg = `uuid of target display does not exist in current displays. ${displayUUID}`
			throw new Termination(msg)
		}

		moveSpaceToDisplay(spaceIndex, display.id)
	}
}

/**
 * @copy `handleSpacesToDisplays`
 */
function handleWindowsToSpaces(currentSpaces, targetSpaces, currentWindows, targetWindows) {
	const currentWindowToSpaceMap = new Map()
	for (const space of currentSpaces) {
		for (const window of space.windows) {
			if (currentWindowToSpaceMap.has(window)) {
				const existingSpace = currentWindowToSpaceMap.get(window)
				const msg = `window pid ${window} already exists in space ${existingSpace}`
				throw new Termination(msg)
			}

			currentWindowToSpaceMap.set(window, space.uuid)
		}
	}

	const windowsToMoveToSpaces = []
	const windowsWithNoMatch = []
	const windowsWithMultipleMatch = []
	for (let i = 0; i < targetSpaces.length; i++) {
		const targetSpace = targetSpaces[i]

		for (const _window of targetSpace.windows) {
			let currSpaceUUID
			let windowID
			const hasWindow = (id) => currentWindowToSpaceMap.has(id)
			const takeWindow = (id) => {
				currSpaceUUID = currentWindowToSpaceMap.get(id)
				windowID = id
				currentWindowToSpaceMap.delete(id)
			}

			if (hasWindow(_window)) {
				takeWindow(_window)
			} else {
				/**
				 * try matching by exact window title
				 */
				const targetWindowFull = targetWindows.find(x => x.id === _window)

				if (!targetWindowFull) {
					const msg = `expected to find full object of target window, but didn't. ${_window}`
					throw new Termination(msg)
				}

				const potentialMatchesInCurrent = currentWindows.filter(x => x.title === targetWindowFull.title && x.app === targetWindowFull.app)

				const matchesCount = potentialMatchesInCurrent.length
				if (matchesCount === 1) {
					const matchedWindow = potentialMatchesInCurrent[0]
					takeWindow(matchedWindow.id)
					// console.log(`found match for window ${_window} in space ${currSpaceUUID}.`, { targetTitle, matchedWindow })
				} else if (matchesCount === 0) {
					windowsWithNoMatch.push(targetWindowFull)
					continue
				} else {
					/** found >1 match, thus no go */
					windowsWithMultipleMatch.push(targetWindowFull)
					continue
				}
			}

			const needsToBeMoved = currSpaceUUID !== targetSpace.uuid

			// console.log({window, currSpaceUUID})

			if (needsToBeMoved) {
				windowsToMoveToSpaces.push([windowID, targetSpace.uuid])
			}
		}
	}

	const takeWindowKeys = takeKeys(["id", "pid", "app", "title", "NOT_FOUND"])
	console.log({ windowsWithNoMatch: windowsWithNoMatch.map(takeWindowKeys)})
	console.log({ windowsWithMultipleMatch: windowsWithMultipleMatch.map(takeWindowKeys)})
	console.log({ windowsToMoveToSpaces })

	const currentUnhandledWindows = [...currentWindowToSpaceMap.keys()].map(id => currentWindows.find(x => x.id === id) || { NOT_FOUND: true, id })
	console.log({ currentUnhandledWindows: currentUnhandledWindows.map(takeWindowKeys) })

	for (const [window, spaceUUID] of windowsToMoveToSpaces) {
		const space = currentSpaces.find(x => x.uuid === spaceUUID)

		if (!space) {
			const msg = `uuid of target display does not exist in current displays. ${spaceUUID}`
			throw new Termination(msg)
		}

		moveWindowToSpace(window, space.id)
	}

	/**
	 * move to the last space - better than keeping a mess in existing spaces
	 * 
	 * or is it? e.g. if window couldn't be matched, but was in correct place already?
	 * 
	 * maybe need to ask user - what they want to do.
	 */
	const lastCurrentSpace = currentSpaces[currentSpaces.length - 1]
	for (const window of currentUnhandledWindows) {
		moveWindowToSpace(window.id, lastCurrentSpace.index)
	}
}

const takeKeys = (keys) => (obj) => filterEntries(obj, ([k]) => keys.includes(k))
function filterEntries(obj, filterFn) {
	return Object.fromEntries(Object.entries(obj).filter(filterFn))
}

function parseWorkspacesData({ targetFile }) {
	const target = JSON.parse(fs.readFileSync(targetFile, { encoding: "utf-8" }))

	const readDirectScriptPath = path.join(__dirname, "read-direct")
	const current = JSON.parse(cp.execSync(readDirectScriptPath, { encoding: "utf-8" }))

	return {
		target,
		current,
	}
}

function moveSpaceToDisplay(spaceIndex, displayID) {
	const cmd = `yabai -m space ${spaceIndex} --display ${displayID}`

	cp.execSync(cmd)
}

function moveWindowToSpace(windowID, spaceIndex) {
	const cmd = `yabai -m window ${windowID} --space ${spaceIndex}`
	console.log({cmd})

	cp.execSync(cmd)
}

function reconcile_cli(argv = process.argv.slice(2)) {
	try {
		const opts = parseArgv(argv)
		reconcile(opts)
	} catch (e) {
		if (e instanceof Termination) {
			process.stderr.write("\n" + e.message + "\n\n")
			process.exit(1)
		} else {
			throw e
		}
	}
}

function parseArgv(argv) {
	const opts = {}

	const eat = () => argv.shift()

	if (!argv.length) {
		const msg = `target file is required`
		throw new Termination(msg)
	}

	if (argv.length === 1) {
		opts.targetFile = eat()
		return opts
	}

	while (argv.length) {
		TODO()
	}

	return opts
}

function TODO() {
	throw new Error("not implemented")
}

class Termination extends Error {}

if (!module.parent) {
	reconcile_cli()
}
