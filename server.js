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

app.get("/api/v1/read", async (_req, res) => {
	try {
		const current = readCurrentStringified()

		return res.status(200).send(current)
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

function store(data, filepath) {
	const dirpath = path.dirname(filepath)

	fs.mkdirSync(dirpath, { recursive: true })
	fs.writeFileSync(filepath, JSON.stringify(data))
}

function readFromStored() {

}

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
