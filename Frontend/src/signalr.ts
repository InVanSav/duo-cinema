import * as signalR from "@microsoft/signalr";

export const connection = new signalR.HubConnectionBuilder()
    .withUrl("https://twenty-four-frames.ru/watch")
    .withAutomaticReconnect()
    .build();