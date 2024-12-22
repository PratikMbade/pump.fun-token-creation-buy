export async function sendLocalCreateBundleSimulationFirst() {
    try {
      // 1) Prepare your wallets (signers)

      // 2) Generate random keypair for your new token
      const mintKeypair = Keypair.generate();
      console.log('mint address',mintKeypair.publicKey.toString())
      let formData = new FormData();

const tokenPath = path.join(__dirname, "solana-token.png");
const fileBlob = await fs.openAsBlob(tokenPath);

console.log('fileBlob', fileBlob)

      // 3) Define token metadata
      let tokenMetadata = {
        name: "Verto",
        symbol: "VTO",
        description: "This is an Verto token created via pump.fun api",

      };

      // 4) Upload metadata to IPFS
      formData.append("file", fileBlob, "./solana-token.png");
      formData.append("name", tokenMetadata.name);
      formData.append("symbol", tokenMetadata.symbol);
      formData.append("description", tokenMetadata.description);
      formData.append("showName", "true");

      let metadataResponse = await fetch("https://pump.fun/api/ipfs", {
        method: "POST",
        body: formData,
      });
      console.log('metadataResponse', metadataResponse)
      let metadataResponseJSON = await metadataResponse.json();

      // 5) Prepare the transaction arguments for bundling
      const bundledTxArgs = [
        {
          publicKey: signerKeyPairs[0].publicKey.toBase58(),
          action: "create",
          tokenMetadata: {
            name: tokenMetadata.name,
            symbol: tokenMetadata.symbol,
            uri: metadataResponseJSON.metadataUri,
          },
          mint: mintKeypair.publicKey.toBase58(),
          denominatedInSol: "false",
          amount: 10000000,
          slippage: 10,
          priorityFee: 0.0001, // jito tip
          pool: "pump",
        },
        {
          publicKey: signerKeyPairs[1].publicKey.toBase58(),
          action: "buy",
          mint: mintKeypair.publicKey.toBase58(),
          denominatedInSol: "false",
          amount: 1000000,
          slippage: 10,
          priorityFee: 0.00005, // ignored after first tx
          pool: "pump",

        },
        // up to 5 transactions
      ];

      // 6) Get the transactions from the local endpoint
      const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bundledTxArgs),
      });

      if (response.status !== 200) {
        console.log("Error from trade-local: ", response.statusText);
        return;
      }

      // 7) Deserialize (decode) the returned transactions
      const transactions = await response.json();

      console.log('transactions', transactions)

      let encodedSignedTransactions = [];
      let signatures = [];
      for(let i = 0; i < bundledTxArgs.length; i++){
          const tx = VersionedTransaction.deserialize(new Uint8Array(bs58.decode(transactions[i])));
          if(bundledTxArgs[i].action === "create"){  // creation transaction needs to be signed by mint and creator keypairs
              tx.sign([mintKeypair, signerKeyPairs[i]])
          } else {
              tx.sign([signerKeyPairs[i]]);
          }
          encodedSignedTransactions.push(bs58.encode(tx.serialize()));
          signatures.push(bs58.encode(tx.signatures[0]));
      }

    //   let encodedSignedTransactions = [];
    //   let signatures:any[] = [];

      // 8) Create a Connection object for simulation
      //    (Use the desired endpoint, e.g. mainnet-beta or a devnet for testing)
      const connection = new Connection(rpc ,{
        commitment: "confirmed",
      });

      // 9) Loop through each bundled transaction, sign it, then simulate
      for (let i = 0; i < bundledTxArgs.length; i++) {
        const rawTx = bs58.decode(transactions[i]);
        const tx = VersionedTransaction.deserialize(new Uint8Array(rawTx));

        // Signers differ if it's a "create" or "buy" action
        if (bundledTxArgs[i].action === "create") {
          tx.sign([mintKeypair, signerKeyPairs[i]]);
          console.log('tx 1', tx)
        } else {
          tx.sign([signerKeyPairs[i]]);
            console.log('tx 2', tx)

        }

        // Simulate the transaction *before* adding it to your final list
        const simulationResult = await connection.simulateTransaction(tx);

        if (simulationResult.value.err) {
          console.error(`Simulation for TX ${i} failed:`, simulationResult.value.err);
          console.error(simulationResult.value.err);
          console.error(simulationResult.value.logs);

          // Optionally break or return here if you do not want to send a failing transaction
          return;
        } else {
          console.log(`Simulation for TX ${i} succeeded. Logs:`);
          console.log(simulationResult.value.logs);
        }

        // If simulation passes, push the transaction to the final array
        encodedSignedTransactions.push(bs58.encode(tx.serialize()));
        signatures.push(bs58.encode(tx.signatures[0]));
      }

      // 10) All transactions simulated successfully. Now you can optionally send to Jito.
    //   try {
    //     const jitoResponse = await fetch(`https://mainnet.block-engine.jito.wtf/api/v1/bundles`, {
    //       method: "POST",
    //       headers: {
    //         "Content-Type": "application/json",
    //       },
    //       body: JSON.stringify({
    //         jsonrpc: "2.0",
    //         id: 1,
    //         method: "sendBundle",
    //         params: [encodedSignedTransactions],
    //       }),
    //     });
    //     console.log("Jito response:", await jitoResponse.json());
    //   } catch (error) {
    //     console.error("Error sending to Jito:", error);
    //   }

    //   // 11) For your own tracking, print out each transaction signature
    //   for (let i = 0; i < signatures.length; i++) {
    //     console.log(`Transaction ${i}: https://solscan.io/tx/${signatures[i]}`);
    //   }
    } catch (err) {
      console.error("Error in sendLocalCreateBundleSimulationFirst:", err);
    }
  }
