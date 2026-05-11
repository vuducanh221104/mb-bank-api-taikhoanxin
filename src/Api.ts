/*
 * MIT License
 *
 * Copyright (c) 2024 CookieGMVN and contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// 
import { existsSync, readFileSync } from "node:fs";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import moment from "moment";

import { TransactionInfo } from "./typings/MBApi";
import { MB } from "./index";

type ApiResponse = {
    status: "success" | "error",
    message: string,
    TranList: Array<{
        refNo: string,
        tranId: string,
        postingDate: string,
        transactionDate: string,
        accountNo: string,
        creditAmount: string,
        debitAmount: string,
        currency: string,
        description: string,
        availableBalance: string,
        beneficiaryAccount: string,
    }>,
};

function loadEnvFile(path = ".env") {
    if (!existsSync(path)) return;

    const envFile = readFileSync(path, "utf8");

    for (const line of envFile.split(/\r?\n/)) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith("#")) continue;

        const separatorIndex = trimmedLine.indexOf("=");
        if (separatorIndex === -1) continue;

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

        if (key && process.env[key] === undefined) process.env[key] = value;
    }
}

function sendJson(response: ServerResponse, statusCode: number, data: unknown) {
    response.writeHead(statusCode, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify(data, null, 2));
}

function mapTransaction(transaction: TransactionInfo): ApiResponse["TranList"][number] {
    return {
        refNo: transaction.refNo,
        tranId: transaction.refNo,
        postingDate: transaction.postDate,
        transactionDate: transaction.transactionDate,
        accountNo: transaction.accountNumber,
        creditAmount: transaction.creditAmount || "0",
        debitAmount: transaction.debitAmount || "0",
        currency: transaction.transactionCurrency,
        description: transaction.transactionDesc,
        availableBalance: transaction.balanceAvailable,
        beneficiaryAccount: transaction.toAccountNumber || "",
    };
}

loadEnvFile();

const username = process.env.MB_USERNAME;
const password = process.env.MB_PASSWORD;
const defaultAccountNumber = process.env.MB_BANK_CARD_DEFAULT || "";
const port = Number(process.env.PORT || 5001);
const defaultDays = Number(process.env.MB_TRANSACTION_DAYS || 7);

if (!username || !password) {
    throw new Error("Missing MB_USERNAME or MB_PASSWORD in .env.");
}

if (!defaultAccountNumber) {
    throw new Error("Missing MB_BANK_CARD_DEFAULT in .env.");
}

const mb = new MB({
    username,
    password,
    preferredOCRMethod: "default",
    saveWasm: true,
});

let loginPromise: Promise<unknown> | null = null;

async function ensureLoggedIn() {
    if (!loginPromise) {
        loginPromise = mb.login().catch((error) => {
            loginPromise = null;
            throw error;
        });
    }

    await loginPromise;
}

async function getTransactions(url: URL): Promise<ApiResponse> {
    await ensureLoggedIn();

    const accountNumber = url.searchParams.get("accountNo") || defaultAccountNumber;
    const fromDate = url.searchParams.get("fromDate") || moment().subtract(defaultDays, "days").format("DD/MM/YYYY");
    const toDate = url.searchParams.get("toDate") || moment().format("DD/MM/YYYY");
    const transactions = await mb.getTransactionsHistory({
        accountNumber,
        fromDate,
        toDate,
    });

    return {
        status: "success",
        message: "Thành công",
        TranList: (transactions || []).map(mapTransaction),
    };
}

async function handleRequest(request: IncomingMessage, response: ServerResponse) {
    if (request.method === "OPTIONS") {
        sendJson(response, 204, {});
        return;
    }

    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    try {
        if (request.method === "GET" && url.pathname === "/transactions/MB") {
            sendJson(response, 200, await getTransactions(url));
            return;
        }

        if (request.method === "GET" && url.pathname === "/health") {
            sendJson(response, 200, { status: "success", message: "OK" });
            return;
        }

        sendJson(response, 404, {
            status: "error",
            message: "Not found",
            TranList: [],
        });
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        sendJson(response, 500, {
            status: "error",
            message,
            TranList: [],
        });
    }
}

createServer(handleRequest).listen(port, () => {
    console.log(`MB API server is running at http://localhost:${port}`);
    console.log(`Transactions endpoint: http://localhost:${port}/transactions/MB`);
});
