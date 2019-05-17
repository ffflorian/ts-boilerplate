workflow "Install, lint and build" {
  on = "push"
  resolves = [
    "Lint project",
    "Build project"
  ]
}

action "Don't skip CI" {
  uses = "ffflorian/actions/skip-ci-check@master"
}

action "Install dependencies" {
  uses = "docker://node:11-slim"
  needs = "Don't skip CI"
  runs = "yarn"
}

action "Lint project" {
  uses = "docker://node:11-slim"
  needs = "Install dependencies"
  runs = "yarn"
  args = "lint"
}

action "Build project" {
  uses = "docker://node:11-slim"
  needs = "Install dependencies"
  runs = "yarn"
  args = "dist"
}
