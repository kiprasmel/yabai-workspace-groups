#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const util = require("util")

const express = require("express")
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

const execS = (cmd, extra) => execSync(cmd, { encoding: "utf-8", ...extra })

app.get("/api/v1/read", async (req, res) => {
	const shouldConvertToHierarchy = "hierarchy" in req.query

	try {
		const current = readCurrentStringified()

		if (!shouldConvertToHierarchy) {
			return res.status(200).send(current)
		} else {
			const currentParsed = JSON.parse(current)
			const currentInHierarchy = convertToHierarchy(currentParsed)
			return res.status(200).json(currentInHierarchy)
		}
	} catch (err) {
		console.error(err)
		return res.status(500).json({ err })
	}
})

function readCurrentStringified() {
	const displays = execS("yabai -m query --displays")
	const spaces = execS("yabai -m query --spaces")
	const windows = execS("yabai -m query --windows")

	/** see `read-direct` */
	const data = util.format('{"displays":%s,"spaces":%s,"windows":%s}\n', displays, spaces, windows)

	return data
}

/**
 * @mutates data
 */
function convertToHierarchy(data) {
	const stats = {
		displays: data.displays.length,
		spaces: data.spaces.length,
		windows: data.windows.length,
	}

	/** convert windowIDs to full window objects */
	data.spaces = data.spaces.map(space => Object.assign(space, {
		windows: space.windows.map(windowId => {
			return data.windows.find(window => window.id === windowId)
		})
	}))

	/** convert spaceIndexes into full space objects */
	data.displays = data.displays.map(display => Object.assign(display, {
		spaces: display.spaces.map(spaceIndex => {
			return data.spaces.find(space => space.index === spaceIndex)
		})}
	))

	return {
		/** root level (has everything else) */
		displays: data.displays,
		stats,
	}
}

function store(data, filepath) {
	const dirpath = path.dirname(filepath)

	fs.mkdirSync(dirpath, { recursive: true })
	fs.writeFileSync(filepath, JSON.stringify(data))
}

function readFromStored() {

}

/** serve static client */
app.use(express.static(path.join(__dirname, "client")))

function startServer({
	PORT = process.env.PORT || 19420
} = {}) {
	return app.listen(PORT, () => {
		const msg = `server listening on port ${PORT}`
		console.log(msg)
	})
}

module.exports = {
	startServer,
}

if (!module.parent) {
	startServer()
}
