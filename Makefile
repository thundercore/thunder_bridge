
VALIDATOR_DIR=validator/
E2E_DIR=validator/e2e/

build-deployer:
	docker build -t thunder_bridge_deployer contracts


deploy-truffle: build-deployer
	# cd $(VALIDATOR_DIR) && npm run dev-chain
	docker run --rm --network=host \
		-v $(PWD)/contracts/deploy/env.local:/contracts/deploy/.env \
		-v $(PWD)/data:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-e2e: build-deployer
	cd $(E2E_DIR) && docker-compose up -d --build home-chain foreign-chain
	docker run --rm --network=host \
		-v $(PWD)/contracts/deploy/env.e2e:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


e2e-test: deploy-e2e
	cd $(E2E_DIR) && docker-compose build validator && docker-compose up -d
	cd $(E2E_DIR) && docker-compose -f docker-compose-e2e.yaml run e2e

stress: deploy-e2e
	cd $(E2E_DIR) && docker-compose build validator && docker-compose up -d
	cd $(E2E_DIR) && docker-compose -f docker-compose-stress.yaml up -d