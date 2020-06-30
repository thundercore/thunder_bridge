
VALIDATOR_DIR=validator/
E2E_DIR=validator/e2e/

build-deployer:
	docker build -t thunder_bridge_deployer contracts


deploy-truffle: build-deployer
	cd $(VALIDATOR_DIR) && docker-compose up -d truffle
	docker run --rm --network=host \
		-v $(PWD)/contracts/deploy/env.local:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-pala: build-deployer
	cd $(VALIDATOR_DIR) && docker-compose up -d pala
	docker run --rm --network=host \
		-v $(PWD)/contracts/deploy/env.local:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-e2e: build-deployer
	cd $(E2E_DIR) && docker-compose -f docker-compose-infra.yaml up -d --build
	docker run --rm --network=host \
		-v $(PWD)/contracts/deploy/env.e2e:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-stress: build-deployer
	cd $(E2E_DIR) && docker-compose -f docker-compose-infra.yaml up -d --build
	docker run --rm --network=host \
		-v $(PWD)/contracts/deploy/env.stress:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


clean-chain:
	cd $(VALIDATOR_DIR) && docker-compose down
	cd $(E2E_DIR) && docker-compose -f docker-compose-infra.yaml down


run-%:
	cd $(E2E_DIR) && cp envs/$*.env validator.env
	cd $(E2E_DIR) && docker-compose build validator && docker-compose -p $* up -d

clean-%:
	cd $(E2E_DIR) && cp envs/$*.env validator.env
	cd $(E2E_DIR) && docker-compose -p $* down

test-e2e: deploy-e2e run-v1
	cd $(E2E_DIR) && docker-compose -f docker-compose-e2e.yaml run e2e

test-truffle:
	cd $(VALIDATOR_DIR) && docker-compose run --rm truffle-test

test-unittest:
	cd $(VALIDATOR_DIR) && python run-test.py unittest

run-all: run-v1 run-v2 run-v3

stress: deploy-stress run-all
	cd $(E2E_DIR) && docker-compose -f docker-compose-stress.yaml up -d

crash: deploy-stress run-all
	cd $(VALIDATOR_DIR) && python scripts/crash-test.py | tee crash.log

test-all: test-e2e test-unittest test-truffle clean

clean: clean-chain clean-v1 clean-v2 clean-v3