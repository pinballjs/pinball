docker build -t pinballjs .
docker run --name pinballjs --detach --volume /n4/pinball:/n4/pinball pinballjs
