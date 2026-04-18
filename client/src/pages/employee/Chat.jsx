import { useEffect, useState, useContext, useRef } from "react";
import api from "../../services/api";
import { SocketContext } from "../../socket/SocketContext";
import { useAuth } from "../../context/AuthContext";

function Chat() {
  const { user } = useAuth();
  const socket = useContext(SocketContext);

  const [chatList, setChatList] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleUnreads, setRoleUnreads] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.split('/api')[0] : "http://localhost:5000";

  // Available roles for channels
  const availableRoles = user.role === "admin"
    ? ["developer", "seo", "designer", "marketing"]
    : [user.role];

  // Request browser notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    api.get("/chat/users").then(res => setUsers(res.data));
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load message history when changing chat focus
  useEffect(() => {
    if (selectedUser) {
      api.get(`/chat/${selectedUser._id}`).then(res => setMessages(res.data));
      // 🔥 Mark as seen when opening chat
      if (socket) {
        socket.emit("mark-seen", { senderId: selectedUser._id, receiverId: user.id });
      }
    } else if (selectedRole) {
      api.get(`/chat/role/${selectedRole}`).then(res => setMessages(res.data));
    } else {
      setMessages([]);
    }
  }, [selectedUser, selectedRole, socket, user.id]);

  // Load users once
  useEffect(() => {
    const fetchUsers = () => {
      api.get("/chat/users").then(res => {
        setUsers(res.data);

        // initialize chat list directly from enriched backend payload
        const initialChats = res.data.map(u => ({
          user: { _id: u._id, name: u.name, role: u.role },
          lastMessage: u.lastMessage || "",
          time: u.time || null,
          unread: u.unread || 0
        }));

        setChatList(initialChats);
      });
    };

    fetchUsers();

    // Listen for dashboard updates (new user registered/approved/deleted)
    if (socket) {
      socket.on("dashboard-update", fetchUsers);
      return () => socket.off("dashboard-update", fetchUsers);
    }

    // Fetch initial role unread counts
    api.get("/chat/unread-roles").then(res => setRoleUnreads(res.data));
  }, [socket]);


  // Listen for real-time messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const senderId = msg.sender._id || msg.sender;
      const receiverId = msg.receiver?._id || msg.receiver;

      const isGroup = msg.isGroupMessage;

      // 👉 update messages (same as before)
      setMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev;

        if (selectedUser && !isGroup) {
          if (
            senderId === selectedUser._id ||
            receiverId === selectedUser._id
          ) {
            // 🔥 If we are currently looking at THIS chat, mark this new message as seen immediately
            if (senderId === selectedUser._id) {
              socket.emit("mark-seen", { senderId: selectedUser._id, receiverId: user.id });
            }
            return [...prev, msg];
          }
        }

        if (selectedRole && isGroup && msg.roleReceiver === selectedRole) {
          return [...prev, msg];
        }

        // 🔔 REAL CHAT NOTIFICATION FOR GROUP MESSAGES (if not actively viewing it)
        // 🔔 ROLE UNREAD COUNT (Handled locally)
        if (isGroup && senderId !== user.id && (!selectedRole || msg.roleReceiver !== selectedRole)) {
          setRoleUnreads(prev => ({
            ...prev,
            [msg.roleReceiver]: (prev[msg.roleReceiver] || 0) + 1
          }));
        }

        return prev;
      });

      // 🔥 UPDATE CHAT LIST (MAIN LOGIC)
      if (!isGroup) {
        const otherUserId =
          senderId === user.id ? receiverId : senderId;

        setChatList(prev => {
          const existing = prev.find(c => c.user._id === otherUserId);

          const isChatOpen = selectedUser?._id === otherUserId;

          const updatedChat = {
            user: existing?.user || users.find(u => u._id === otherUserId),
            lastMessage: msg.message,
            time: msg.createdAt,
            unread: isChatOpen ? 0 : (existing?.unread || 0) + 1
          };

          if (isChatOpen && senderId !== user.id) {
            // Auto mark read if already looking at it
            api.patch(`/chat/read/${otherUserId}`).catch(console.error);
          }

          const filtered = prev.filter(c => c.user._id !== otherUserId);

          return [updatedChat, ...filtered]; // 🔥 move to top
        });
      }
    };

    // Listen for messages-seen updates
    const handleMessagesSeen = (data) => {
      const { seenBy } = data;
      if (selectedUser && seenBy === selectedUser._id) {
        setMessages(prev => prev.map(m => {
          const mReceiverId = m.receiver?._id || m.receiver;
          if (mReceiverId === seenBy) {
            return { ...m, isSeen: true };
          }
          return m;
        }));
      }
    };

    socket.on("new-message", handleNewMessage);
    socket.on("messages-seen", handleMessagesSeen);
    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("messages-seen", handleMessagesSeen);
    };
  }, [socket, selectedUser, selectedRole, user.id, users]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      const res = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      // Auto-send message with file
      sendMessage(null, res.data);
    } catch (err) {
      alert(err.response?.data?.message || "File upload failed");
    } finally {
      setIsUploading(false);
      e.target.value = null; // Reset input
    }
  };

  const sendMessage = (e, fileData = null) => {
    if (e) e.preventDefault();
    if (!text.trim() && !fileData) return;
    if (!selectedUser && !selectedRole) return;

    const payload = {
      senderId: user.id,
      isGroupMessage: !!selectedRole,
      message: text.trim(),
      ...(selectedRole ? { roleReceiver: selectedRole } : { receiverId: selectedUser._id }),
      ...(fileData && {
        fileUrl: fileData.fileUrl,
        fileType: fileData.fileType,
        fileName: fileData.fileName
      })
    };

    socket.emit("send-message", payload);
    setText("");
  };

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setSelectedRole(null);

    // 🔥 reset unread locally
    setChatList(prev =>
      prev.map(c =>
        c.user._id === u._id ? { ...c, unread: 0 } : c
      )
    );

    // mark read in db
    api.patch(`/chat/read/${u._id}`).catch(err => console.error("Failed to mark as read", err));
  };

  const handleSelectRole = (r) => {
    setSelectedRole(r);
    setSelectedUser(null);

    // 🔥 reset unread locally
    setRoleUnreads(prev => ({
      ...prev,
      [r]: 0
    }));

    // mark read in db
    api.patch(`/chat/read-role/${r}`).catch(err => console.error("Failed to mark role as read", err));
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-slate-50">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Team Chat</h2>
        <p className="mt-1 text-sm text-slate-500">Communicate with your colleagues and administration</p>
      </div>

      <div className="flex flex-1 overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200">

        {/* Sidebar */}
        <div className="w-1/3 md:w-80 flex flex-col border-r border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto w-full">
            {/* Channels Section */}
            <div className="px-4 py-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Channels</h4>
              <div className="space-y-1">
                {availableRoles.map((role) => (
                  <div
                    key={role}
                    onClick={() => handleSelectRole(role)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${selectedRole === role
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <span className="text-lg font-bold text-primary-400">#</span>
                    <span className="capitalize flex-1">{role}</span>
                    {roleUnreads[role] > 0 && (
                      <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                        {roleUnreads[role]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">Direct Messages</h4>
            </div>

            {/* Users Section */}
            {filteredUsers.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-slate-400 text-sm">No users found</div>
            ) : (
              chatList
                .filter((chat) =>
                  chat.user.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((chat) => {
                  const u = chat.user;

                  return (
                    <div
                      key={u._id}
                      onClick={() => handleSelectUser(u)}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-l-4 ${selectedUser?._id === u._id
                        ? "bg-primary-50 border-primary-600"
                        : "border-transparent hover:bg-slate-50"
                        }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                          {getInitials(u.name)}
                        </div>

                        {/* Online dot */}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                      </div>

                      {/* Name + Last Message */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">
                          {u.name}
                        </h4>

                        <p className="text-xs text-slate-500 truncate">
                          {chat.lastMessage
                            ? chat.lastMessage
                            : u.role || "Employee"}
                        </p>
                      </div>

                      {/* Right Side (Time + Unread) */}
                      <div className="flex flex-col items-end gap-1">
                        {/* Time */}
                        {chat.time && (
                          <span className="text-[10px] text-slate-400 text-right whitespace-nowrap">
                            {(() => {
                              const d = new Date(chat.time);
                              const today = new Date();
                              const isToday = d.getDate() === today.getDate() && 
                                             d.getMonth() === today.getMonth() && 
                                             d.getFullYear() === today.getFullYear();
                              
                              if (isToday) {
                                return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                              }

                              const yesterday = new Date();
                              yesterday.setDate(yesterday.getDate() - 1);
                              const isYesterday = d.getDate() === yesterday.getDate() && 
                                                 d.getMonth() === yesterday.getMonth() && 
                                                 d.getFullYear() === yesterday.getFullYear();

                              if (isYesterday) return "Yesterday";
                              
                              return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                            })()}
                          </span>
                        )}

                        {/* 🔴 Unread Count */}
                        {chat.unread > 0 && (
                          <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {chat.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedUser || selectedRole ? (
          <div className="flex-1 flex flex-col bg-slate-50/50">
            {/* Chat Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between w-full h-[72px]">
              <div className="flex items-center gap-4">
                {selectedUser ? (
                  <>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                        {getInitials(selectedUser.name)}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-none">{selectedUser.name}</h3>
                      <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center text-xl font-bold shadow-sm">
                      #
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-none capitalize">{selectedRole} Team</h3>
                      <p className="text-xs text-slate-500 mt-1">Broadcast Channel</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700">No messages yet</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    {selectedRole ? `Start the conversation in the #${selectedRole} channel!` : `Say hello to ${selectedUser?.name}`}
                  </p>
                </div>
              ) : (
                (() => {
                  let lastDateLabel = null;
                  
                  return messages.map((m, i) => {
                    const mSenderId = m.sender?._id || m.sender;
                    const isMe = mSenderId === user.id;
                    const isImage = m.fileType?.startsWith("image/");
                    
                    // --- Date Grouping Logic ---
                    const messageDate = new Date(m.createdAt);
                    const today = new Date();
                    
                    const mSnap = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
                    const tSnap = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    
                    const diffDays = Math.round((tSnap - mSnap) / (1000 * 60 * 60 * 24));
                    
                    let currentDateLabel = "";
                    if (diffDays === 0) currentDateLabel = "Today";
                    else if (diffDays === 1) currentDateLabel = "Yesterday";
                    else if (diffDays < 7) currentDateLabel = messageDate.toLocaleDateString(undefined, { weekday: 'long' });
                    else currentDateLabel = messageDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

                    const showDivider = currentDateLabel !== lastDateLabel;
                    lastDateLabel = currentDateLabel;

                    return (
                      <div key={i} className="flex flex-col gap-4">
                        {showDivider && (
                          <div className="flex items-center justify-center my-4">
                            <div className="h-[1px] bg-slate-200 flex-1"></div>
                            <span className="px-4 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-200 shadow-sm mx-4">
                              {currentDateLabel}
                            </span>
                            <div className="h-[1px] bg-slate-200 flex-1"></div>
                          </div>
                        )}

                        <div className={`flex ${isMe ? "justify-end" : "justify-start"} animate-fade-in-up`}>
                          <div className={`max-w-[75%] px-4 py-2.5 shadow-sm text-sm ${isMe
                            ? "bg-primary-600 text-white rounded-2xl rounded-tr-sm"
                            : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm"
                            }`}>
                            {user.role === "admin" && selectedRole && !isMe && (
                              <div className="text-[10px] font-bold text-primary-500 mb-1">Employe Msg</div>
                            )}
                            
                            {/* File Display */}
                            {m.fileUrl && (
                              <div className="mb-2">
                                {isImage ? (
                                  <img 
                                    src={`${API_URL}${m.fileUrl}`} 
                                    alt="Shared media" 
                                    className="max-w-full rounded-lg border border-white/20 shadow-sm transition-transform hover:scale-[1.02] cursor-pointer"
                                    onClick={() => window.open(`${API_URL}${m.fileUrl}`, '_blank')}
                                  />
                                ) : (
                                  <a 
                                    href={`${API_URL}${m.fileUrl}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className={`flex items-center gap-3 p-3 rounded-xl border ${isMe ? 'bg-primary-700/50 border-primary-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'} hover:bg-opacity-80 transition-all`}
                                  >
                                    <div className={`w-10 h-10 rounded-lg ${isMe ? 'bg-primary-500' : 'bg-white'} flex items-center justify-center shadow-sm`}>
                                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold truncate">{m.fileName || "Download Document"}</p>
                                      <p className="text-[10px] opacity-60 uppercase tracking-tighter">Click to download</p>
                                    </div>
                                  </a>
                                )}
                              </div>
                            )}

                            {m.message && <div className="leading-relaxed">{m.message}</div>}

                            {/* Footer (Time + Ticks) */}
                            <div className="flex items-center justify-end gap-1.5 mt-1 opacity-70">
                              <span className="text-[9px] font-medium">
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {isMe && !selectedRole && (
                                <span className={`text-[10px] font-bold ${m.isSeen ? 'text-blue-200' : 'text-slate-300'}`}>
                                  {m.isSeen ? "✓✓" : "✓"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex items-center gap-2"
              >
                {/* File Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0 shadow-sm"
                  title="Attach File"
                >
                  {isUploading ? (
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-primary-600 rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  )}
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                />

                <div className="flex-1 flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:border-primary-400 focus-within:bg-white transition-all shadow-sm">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="flex-1 bg-transparent border-none px-4 py-2 text-sm focus:ring-0 text-slate-800 placeholder:text-slate-400 outline-none"
                    placeholder={selectedRole ? `Message #${selectedRole}...` : "Type a message..."}
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || isUploading}
                    className="w-10 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
                  >
                    <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-6">
              <svg className="w-10 h-10 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800">Your Messages</h3>
            <p className="text-slate-500 mt-2 max-w-sm text-center text-sm leading-relaxed">
              Select a colleague or channel from the sidebar to chat or view recent messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;