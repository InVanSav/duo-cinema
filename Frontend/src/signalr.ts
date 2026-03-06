import * as signalR from "@microsoft/signalr";

export const connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5146/watch")
    .withAutomaticReconnect()
    .build();