#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const express = require("express")
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

const execS = (cmd, extra) => execSync(cmd, { encoding: "utf-8", ...extra })

app.get("/api/v1/read", async (_req, res) => {
	try {
		const current = readCurrent()

		// const data = {
		// 	current,
		// }
		const data = current

		return res.status(200).json(data)
	} catch (err) {
		console.error(err)
		return res.status(500).json({ err })
	}
})

function readCurrent() {
	const displays = JSON.parse(execS("yabai -m query --displays"))
	const spaces = JSON.parse(execS("yabai -m query --spaces"))
	const windows = JSON.parse(execS("yabai -m query --windows"))

	const data = {
		displays,
		spaces,
		windows,
	}

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
