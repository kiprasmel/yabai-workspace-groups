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

	const spacesToMoveToDesktop = []
	/**
	 * TODO: validate still works with various {current|target}Displays counts (1-1, 1-many, many-1, many-many)
	 */
	for (let i = 0; i < targetDisplays.length; i++) {
		const targetDisplay = targetDisplays[i]
		
		let currentDisplay = currentDisplays.find(curr => curr.uuid === targetDisplay.uuid)

		if (!currentDisplay) {
			if (currentDisplays.length === 1) {
				currentDisplay = currentDisplays[0]
			} else {
				const msg = `have multiple current displays, and none of them matched the target display. target = ${targetDisplay.uuid}`
				throw new Termination(msg)
			}
		}

		/**
		 * what spaces to move out of the currentDisplay into targetDisplay,
		 * what spaces to move out of the targetDisplay into somewhere else
		 */
		const spacesDelta = TODO()
	}


	for (const space of spacesToMoveToDesktop) {
		moveSpaceToDesktop(space)
	}

	const windowsToMoveToSpaces = []
	for (const window of windowsToMoveToSpaces) {
		moveWindowToSpace(window)
	}
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

function moveSpaceToDesktop(space) {
	TODO()
}

function moveWindowToSpace(window) {
	TODO()
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
