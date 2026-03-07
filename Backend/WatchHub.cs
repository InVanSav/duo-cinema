namespace DuoCinema;

using Microsoft.AspNetCore.SignalR;

public class WatchHub : Hub
{
    public async Task Video(string url)
        => await Clients.All.SendAsync("Video", url);

    public async Task Play()
        => await Clients.All.SendAsync("Play");

    public async Task Pause()
        => await Clients.All.SendAsync("Pause");

    public async Task Seek(double time)
        => await Clients.All.SendAsync("Seek", time);

    public async Task Chat(string msg)
        => await Clients.All.SendAsync("Chat", msg);

    public async Task Reaction(string emoji)
        => await Clients.All.SendAsync("Reaction", emoji);
}